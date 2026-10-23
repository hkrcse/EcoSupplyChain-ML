// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
    RecyclingSupplyChain v4 (EcoSupplyChain-ML)

    Changes relative to v3:
      I1  one reward per product per reverse stage (v3 keyed the guard on
          (product, wallet), so one product could be paid to many wallets)
      I2  the stage-0 returner must be the recorded final owner (buyer)
      I3  reverse stages must follow Buyer->Store->Supplier->Factory order,
          and each hop must go to the actor that sold the item downstream
      I4  recycle() (material reuse) only by the product's manufacturer and
          only after the item has come back through the reverse chain
      I5  reward-bearing returns go through a two-step request/assessment
          flow; an authenticated off-chain risk service posts a score, and
          high-risk claims are escrowed until the authority resolves them
*/

contract RecyclingSupplyChainV4 {
    struct Product {
        uint256 id;
        string name;
        uint256 price;
        uint256 taxAmount;
        uint256 plasticAmount;
        string productionDate;
        string expiryDate;
        bytes sign;
        address manufacturer;
        address currentOwner;
        bool isRecycled;
        uint256 productCarryingCost;
    }

    struct Participant {
        string role;
        bool verified;
        uint256 totalPlasticBought;
        uint256 totalPlasticReturned;
        uint256 totalPlasticReused;
        uint256 totalTaxWaivePending;
        uint256 totalTaxAmount;
        uint256 stockCount;
        uint256 rewardsClaimedWei;
        uint256 rewardsPending;
    }

    // status of a reverse-flow claim
    enum ClaimStatus { None, Requested, Paid, Held, Rejected }

    struct Claim {
        uint256 productId;
        uint8 stage;            // 0 buyer->store, 1 store->supplier, 2 supplier->factory
        address claimant;       // wallet to be rewarded
        address collector;      // actor receiving the waste
        uint256 measuredWeight; // independently measured grams at collection
        uint256 reward;         // escrowed reward (wei)
        uint16 riskBps;         // risk score in basis points (0..10000)
        bytes32 modelVersion;
        bytes32 evidenceHash;
        ClaimStatus status;
    }

    uint256 public nextProductId;
    uint256 public nextClaimId;
    address public authority;
    address public riskService;
    uint16 public holdThresholdBps = 5000;
    uint256 public recyclingRewardRate = 1e15;

    mapping(address => Participant) public participants;
    mapping(uint256 => Product) public products;
    mapping(uint256 => bytes) public productMsgHash;

    // custody path in the forward flow: path[id][k] = holder at hop k
    mapping(uint256 => address[4]) public custody;
    mapping(uint256 => uint8) public custodyLen;

    // I1: next reverse stage allowed for each product (0..3, 3 = fully returned)
    mapping(uint256 => uint8) public reverseStage;
    // claim currently open for (product)
    mapping(uint256 => uint256) public openClaim;
    mapping(uint256 => Claim) public claims;
    // I4: material reuse recorded once
    mapping(uint256 => bool) public reused;

    event ParticipantRegistered(address indexed who, string role);
    event ProductUploaded(uint256 indexed productId, address indexed manufacturer, uint256 plasticAmount);
    event ProductTransferred(uint256 indexed productId, address indexed from, address indexed to);
    event ReturnRequested(uint256 indexed claimId, uint256 indexed productId, uint8 stage, address claimant, address collector, uint256 measuredWeight);
    event RiskAssessed(uint256 indexed claimId, uint16 riskBps, bytes32 modelVersion, bytes32 evidenceHash);
    event RewardPaid(uint256 indexed claimId, address indexed to, uint256 amount);
    event RewardHeld(uint256 indexed claimId, uint16 riskBps);
    event ClaimResolved(uint256 indexed claimId, bool approved);
    event PlasticReusedRecorded(address indexed manufacturer, uint256 indexed productId, uint256 amount);
    event TaxWaiverCalculated(address indexed manufacturer, uint256 taxWaived);

    modifier onlyAuthority() { require(msg.sender == authority, "Not authorized"); _; }
    modifier onlyVerified() { require(participants[msg.sender].verified, "Not verified participant"); _; }
    modifier onlyRiskService() { require(msg.sender == riskService, "Not risk service"); _; }

    constructor() { authority = msg.sender; }

    function setRiskService(address _svc, uint16 _thresholdBps) external onlyAuthority {
        require(_thresholdBps <= 10000, "bad threshold");
        riskService = _svc;
        holdThresholdBps = _thresholdBps;
    }

    function registerParticipant(address _addr, string memory _role) public onlyAuthority {
        require(_addr != address(0), "Invalid address");
        require(!participants[_addr].verified, "Already registered");
        Participant storage p = participants[_addr];
        p.role = _role;
        p.verified = true;
        emit ParticipantRegistered(_addr, _role);
    }

    function _roleEquals(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function uploadProduct(
        string memory _name, uint256 _price, uint256 _taxAmount, uint256 _plasticAmount,
        string memory _productionDate, string memory _expiryDate, bytes memory _sign
    ) public onlyVerified {
        require(_roleEquals(participants[msg.sender].role, "Factory"), "Only Factory can upload");
        require(_plasticAmount > 0, "Invalid plastic amount");
        uint256 id = nextProductId++;
        products[id] = Product(id, _name, _price, _taxAmount, _plasticAmount, _productionDate,
                               _expiryDate, _sign, msg.sender, msg.sender, false, 0);
        custody[id][0] = msg.sender;
        custodyLen[id] = 1;
        Participant storage m = participants[msg.sender];
        m.stockCount++;
        m.totalPlasticBought += _plasticAmount;
        m.totalTaxAmount += _taxAmount;
        emit ProductUploaded(id, msg.sender, _plasticAmount);
    }

    function getProductInfo(uint256 _id) public view returns (Product memory) {
        require(_id < nextProductId, "No related product found");
        return products[_id];
    }

    function transferProduct(uint256 _id, address _to, uint256 _carryingCost) public onlyVerified {
        require(_id < nextProductId, "Invalid product id");
        Product storage p = products[_id];
        require(p.currentOwner == msg.sender, "Not product owner");
        require(participants[_to].verified, "Receiver not verified");
        require(!p.isRecycled && reverseStage[_id] == 0, "Product in reverse flow");
        uint8 n = custodyLen[_id];
        require(n < 4, "Custody path full");
        participants[msg.sender].stockCount -= 1;
        participants[_to].stockCount += 1;
        participants[_to].totalPlasticBought += p.plasticAmount;
        participants[msg.sender].totalTaxAmount += p.taxAmount;
        p.currentOwner = _to;
        p.price += (_carryingCost + p.taxAmount);
        p.productCarryingCost = _carryingCost;
        custody[_id][n] = _to;
        custodyLen[_id] = n + 1;
        emit ProductTransferred(_id, msg.sender, _to);
    }

    function setEthMsg(uint256 _id, bytes memory _msgHash) public onlyVerified {
        require(products[_id].manufacturer == msg.sender, "Only manufacturer");
        productMsgHash[_id] = _msgHash;
    }

    // ---------------------------------------------------------------
    // REVERSE FLOW: request -> assess -> pay or hold
    // stage s: the holder at custody hop (3-s) hands waste to hop (2-s)
    // and the claimant is the holder at hop (3-s).
    // ---------------------------------------------------------------
    function requestReturn(uint256 _id, uint256 _measuredWeight) external payable onlyVerified returns (uint256 claimId) {
        require(_id < nextProductId, "Invalid product id");
        require(custodyLen[_id] == 4, "Item never reached a buyer");      // I2
        uint8 s = reverseStage[_id];
        require(s < 3, "Reverse flow complete");
        require(openClaim[_id] == 0, "Claim already open");                 // I1
        address claimant = custody[_id][3 - s];
        address collector = custody[_id][2 - s];
        require(msg.sender == collector, "Caller is not the upstream collector"); // I3
        Product storage p = products[_id];
        uint256 reward = p.plasticAmount * recyclingRewardRate;
        require(msg.value >= reward, "Insufficient deposit for reward");

        claimId = ++nextClaimId;
        claims[claimId] = Claim(_id, s, claimant, collector, _measuredWeight, reward, 0, 0, 0, ClaimStatus.Requested);
        openClaim[_id] = claimId;
        if (s == 0) { p.isRecycled = true; }
        p.currentOwner = collector;
        if (msg.value > reward) {
            (bool r, ) = payable(msg.sender).call{value: msg.value - reward}("");
            require(r, "Refund failed");
        }
        emit ReturnRequested(claimId, _id, s, claimant, collector, _measuredWeight);
    }

    function submitAssessment(uint256 _claimId, uint16 _riskBps, bytes32 _modelVersion, bytes32 _evidenceHash)
        external onlyRiskService
    {
        Claim storage c = claims[_claimId];
        require(c.status == ClaimStatus.Requested, "Claim not pending");
        require(_riskBps <= 10000, "bad score");
        c.riskBps = _riskBps;
        c.modelVersion = _modelVersion;
        c.evidenceHash = _evidenceHash;
        emit RiskAssessed(_claimId, _riskBps, _modelVersion, _evidenceHash);
        if (_riskBps >= holdThresholdBps) {
            c.status = ClaimStatus.Held;
            emit RewardHeld(_claimId, _riskBps);
        } else {
            _pay(_claimId);
        }
    }

    function resolveHold(uint256 _claimId, bool _approve) external onlyAuthority {
        Claim storage c = claims[_claimId];
        require(c.status == ClaimStatus.Held, "Not held");
        emit ClaimResolved(_claimId, _approve);
        if (_approve) {
            _pay(_claimId);
        } else {
            c.status = ClaimStatus.Rejected;
            openClaim[c.productId] = 0;
            (bool r, ) = payable(c.collector).call{value: c.reward}("");   // return deposit
            require(r, "Refund failed");
        }
    }

    function _pay(uint256 _claimId) internal {
        Claim storage c = claims[_claimId];
        c.status = ClaimStatus.Paid;
        openClaim[c.productId] = 0;
        reverseStage[c.productId] = c.stage + 1;
        Participant storage w = participants[c.claimant];
        w.totalPlasticReturned += products[c.productId].plasticAmount;
        w.rewardsClaimedWei += c.reward;
        (bool sent, ) = payable(c.claimant).call{value: c.reward}("");
        require(sent, "Reward transfer failed");
        emit RewardPaid(_claimId, c.claimant, c.reward);
    }

    // I4: reuse only by the manufacturer, only after the full reverse path
    function recycle(uint256 _id) public onlyVerified {
        require(_id < nextProductId, "Invalid product id");
        Product storage p = products[_id];
        require(p.manufacturer == msg.sender, "Only manufacturer");
        require(reverseStage[_id] == 3, "Material not returned");
        require(!reused[_id], "Already reused");
        reused[_id] = true;
        participants[msg.sender].totalPlasticReused += p.plasticAmount;
        emit PlasticReusedRecorded(msg.sender, _id, p.plasticAmount);
    }

    function authorityTaxWaiveToFactory(address _manufacturer) public onlyAuthority {
        Participant storage m = participants[_manufacturer];
        require(m.totalTaxAmount > 0, "No tax to waive");
        require(m.totalPlasticBought > 0, "No plastic bought record");
        uint256 waive = (m.totalTaxAmount * m.totalPlasticReused) / m.totalPlasticBought;
        if (waive > m.totalTaxAmount) { waive = m.totalTaxAmount; }
        m.totalTaxAmount -= waive;
        m.totalTaxWaivePending += waive;
        emit TaxWaiverCalculated(_manufacturer, waive);
    }

    function profitCheck(uint256 _buyingPrice, uint256 _productId) public view returns (bool) {
        require(_productId < nextProductId, "Invalid product id");
        return (_buyingPrice <= (products[_productId].productCarryingCost + products[_productId].price));
    }

    receive() external payable {}
}
