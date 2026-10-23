// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
    RecyclingSupplyChain v3 - corrected
*/

contract RecyclingSupplyChain {
    // -------------------------
    // STRUCTS
    // -------------------------
    struct Product {
        uint256 id;
        string name;
        uint256 price;
        uint256 taxAmount;
        uint256 plasticAmount;      // total plastic (grams or kg)
        string productionDate;
        string expiryDate;
        bytes sign;
        address manufacturer;
        address currentOwner;
        bool isRecycled;
        uint256 productCarryingCost;
    }

    struct Participant {
        string role;                  // "Factory", "Supplier", "Store", "Buyer"
        bool verified;
        uint256 totalPlasticBought;      // plastic bought via products
        uint256 totalPlasticReturned;    // plastic returned upstream
        uint256 totalPlasticReused;      // manufacturer-only metric
        uint256 totalTaxWaivePending;
        uint256 totalTaxAmount;
        uint256 stockCount;              // current owned products
        uint256 rewardsClaimedWei;       // total ETH claimed
        uint256 rewardsPending;          // accumulated pending rewards
    }

    // -------------------------
    // STATE VARIABLES
    // -------------------------
    uint256 public nextProductId;
    address public authority;
    uint256 public recyclingRewardRate = 1e15; // 0.001 ETH per plastic unit

    mapping(address => Participant) public participants;
    mapping(uint256 => Product) public products;
    mapping(address => Product[]) public productLists;
    mapping(uint256 => bytes)public productMsgHash;


    // productId => participant => recycled?
    mapping(uint256 => mapping(address => bool)) public hasRecycled;

    // -------------------------
    // EVENTS
    // -------------------------
    event ProductUploaded(uint256 indexed productId, address indexed manufacturer, uint256 plasticAmount);
    event ProductTransferred(uint256 indexed productId, address indexed from, address indexed to);
    event ProductRecycled(uint256 indexed productId, address indexed recycler, uint256 plasticReturned, uint256 reward);
    event RewardPaid(address indexed from, address indexed to, uint256 amount);
    event PlasticReusedRecorded(address indexed manufacturer, uint256 amount);
    event TaxWaiverCalculated(address indexed manufacturer, uint256 taxWaived);
    event ParticipantRegistered(address indexed who, string role);


    // -------------------------
    // MODIFIERS
    // -------------------------
    modifier onlyAuthority() {
        require(msg.sender == authority, "Not authorized");
        _;
    }

    modifier onlyVerified() {
        require(participants[msg.sender].verified, "Not verified participant");
        _;
    }

    // -------------------------
    // CONSTRUCTOR
    // -------------------------
    constructor() {
        authority = msg.sender;
    }

    // -------------------------
    // PARTICIPANT MANAGEMENT
    // -------------------------
    function registerParticipant(address _addr, string memory _role) public onlyAuthority {
        require(_addr != address(0), "Invalid address");
        // prevent re-registering an already registered participant
        require(!participants[_addr].verified, "Already registered");

        participants[_addr] = Participant({
            role: _role,
            verified: true,
            totalPlasticBought: 0,
            totalPlasticReturned: 0,
            totalPlasticReused: 0,
            totalTaxWaivePending: 0,
            totalTaxAmount: 0,
            stockCount: 0,
            rewardsClaimedWei: 0,
            rewardsPending: 0
        });

        emit ParticipantRegistered(_addr, _role);
    }

    // helper to compare roles
    function _roleEquals(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    // -------------------------
    // PRODUCT MANAGEMENT
    // -------------------------
    function uploadProduct(
        string memory _name,
        uint256 _price,
        uint256 _taxAmount,
        uint256 _plasticAmount,
        string memory _productionDate,
        string memory _expiryDate,
        bytes memory _sign
    ) public onlyVerified {
        require(_roleEquals(participants[msg.sender].role, "Factory"), "Only Factory can upload");

        // store product in products mapping
        products[nextProductId] = Product({
            id: nextProductId,
            name: _name,
            price: _price,
            taxAmount: _taxAmount,
            plasticAmount: _plasticAmount,
            productionDate: _productionDate,
            expiryDate: _expiryDate,
            sign: _sign,
            manufacturer: msg.sender,
            currentOwner: msg.sender,
            isRecycled: false,
            productCarryingCost: 0
        });

        // assign to manufacturer's product list
        _setFactoryProductTo(msg.sender, products[nextProductId]);

        participants[msg.sender].stockCount++;
        participants[msg.sender].totalPlasticBought += _plasticAmount;
        participants[msg.sender].totalTaxAmount += _taxAmount;

        emit ProductUploaded(nextProductId, msg.sender, _plasticAmount);
        nextProductId++;
    }
    function getProductInfo(uint256 _id) public view returns (Product memory) {
            require(_id < nextProductId, "No related product found");
            return products[_id];
        }



    // internal version with stricter checks
    function _setFactoryProductTo(address _to, Product memory _info) internal {
        require(_to != address(0), "Invalid address");
        require(participants[_to].verified, "Receiver not verified");

        // Check for duplicate product ID
        Product[] storage productArray = productLists[_to];
        for (uint256 i = 0; i < productArray.length; i++) {
            if (productArray[i].id == _info.id) {
                revert("Product already assigned");
            }
        }

        productArray.push(_info);
    }

    // kept public but without onlyVerified (read-only)
    function getFactoryProductTo(address _to) public view returns (Product[] memory) {
        return productLists[_to];
    }

    // public wrapper that enforces caller is verified when assigning (used externally)
    function setFactoryProductTo(address _to, Product memory _info) public onlyVerified {
        // allow only verified callers to add products to recipients
        _setFactoryProductTo(_to, _info);
    }

    // -------------------------
    // SUPPLY CHAIN TRANSFER
    // -------------------------
    function transferProduct(uint256 _id, address _to, uint256 _carryingCost) public onlyVerified {
        require(_id < nextProductId, "Invalid product id");
        Product storage p = products[_id];
        require(p.currentOwner == msg.sender, "Not product owner");
        require(participants[_to].verified, "Receiver not verified");
        require(!p.isRecycled, "Product already recycled");

        // update counts & tax
        participants[msg.sender].stockCount = participants[msg.sender].stockCount - 1;
        participants[_to].stockCount = participants[_to].stockCount + 1;
        participants[_to].totalPlasticBought += p.plasticAmount;
        participants[msg.sender].totalTaxAmount += p.taxAmount;

        // state updates
        p.currentOwner = _to;
        p.price +=(_carryingCost + p.taxAmount);
        p.productCarryingCost = _carryingCost;

        // record in recipient list
        _setFactoryProductTo(_to, products[_id]);

        Product[] storage productArray = productLists[msg.sender];
        for (uint256 i = 0; i < productArray.length; i++) {
            if (productArray[i].id == _id) {
                productArray[i].currentOwner = _to;
                break;
            }
        }

        emit ProductTransferred(_id, msg.sender, _to);
    }
    // -------------------------------------
    // SET ETH MESSAGE HASH FOR VERIFICATION
    // -------------------------------------

    function setEthMsg(uint256 _id,bytes memory _msgHash)public onlyVerified{
        productMsgHash[_id] = _msgHash;
    }


    // -------------------------
    // RECYCLING & REWARDS
    // -------------------------
   function recycleWaste(uint256 _id, address _wallet) public payable onlyVerified {
    require(_id < nextProductId, "Invalid product id");
    Product storage p = products[_id];

    require(!hasRecycled[_id][_wallet], "Already recycled");
    require(p.plasticAmount > 0, "Invalid plastic amount");
    require(participants[_wallet].verified, "Recipient not registered");

    // --- Step 1: Deposit by sender ---
    // msg.value must be greater than or equal to required reward
    uint256 plasticReturned = p.plasticAmount;
    uint256 rewardAmount = (plasticReturned * recyclingRewardRate);

    require(msg.value >= rewardAmount, "Insufficient deposit for reward");

    // --- Step 2: Pay the recycler ---
    (bool sent, ) = payable(_wallet).call{value: rewardAmount}("");
    require(sent, "Reward transfer failed");

    // --- Step 3: Apply state changes ---
    hasRecycled[_id][_wallet] = true;

    // transfer ownership to recycler (msg.sender)
    address previousOwner = p.currentOwner;
    p.currentOwner = msg.sender;
    p.isRecycled = true;

    // update participant stats
    participants[_wallet].totalPlasticReturned += plasticReturned;
    participants[_wallet].rewardsClaimedWei += rewardAmount;

    // --- Update product list for previous owner ---
    Product[] storage ownerProducts = productLists[previousOwner];
    for (uint256 i = 0; i < ownerProducts.length; i++) {
        if (ownerProducts[i].id == _id) {
            ownerProducts[i].isRecycled = true;
            ownerProducts[i].currentOwner = msg.sender;
            break;
        }
    }

    // --- Update recycler's product list ---
    Product[] storage recyclerProducts = productLists[msg.sender];
    bool found = false;
    for (uint256 i = 0; i < recyclerProducts.length; i++) {
        if (recyclerProducts[i].id == _id) {
            recyclerProducts[i].currentOwner = msg.sender;
            found = true;
            break;
        }
    }

    // --- Step 4: Emit events ---
    emit ProductRecycled(_id, _wallet, plasticReturned, rewardAmount);
    emit RewardPaid(msg.sender, _wallet, rewardAmount);

    // --- Step 5: Refund any excess Ether ---
    if (msg.value > rewardAmount) {
        (bool refunded, ) = payable(msg.sender).call{value: msg.value - rewardAmount}("");
        require(refunded, "Refund failed");
    }
}

    // --------------------------------
    // MANUFACTURER REUSE PRODUCT WASTE
    // --------------------------------
    function recycle(uint256 _id) public onlyVerified {

    require(_id < nextProductId, "Invalid product id");
    Product storage p = products[_id];
    require(!hasRecycled[_id][msg.sender], "Already recycled");
    require(p.plasticAmount > 0, "Invalid plastic amount");
    require(participants[msg.sender].verified, "Recipient not registered");

    // --- checks passed: apply effects first ---
    hasRecycled[_id][msg.sender] = true;
   

    // update participant stats
    participants[msg.sender].totalPlasticReused += p.plasticAmount;
  
    // Update productLists arrays: mark owner entry as recycled
    Product[] storage ownerProducts = productLists[msg.sender];
    for (uint256 i = 0; i < ownerProducts.length; i++) {
        if (ownerProducts[i].id == _id) {
            ownerProducts[i].isRecycled = true;
            break;
        }
    }

    }

    // Authority tax waive to Factory
  function authorityTaxWaiveToFactory(address _manufacturer) public onlyAuthority {
    Participant storage m = participants[_manufacturer];
    require(m.totalTaxAmount > 0, "No tax to waive");
    require(m.totalPlasticBought > 0, "No plastic bought record");

    // --- Precision Scaling Factor ---
    uint256 SCALE = 1e6; // acts like 6 decimal places

    // --- Scaled Waive Calculation ---
    // (taxAmount * reused * SCALE) / bought keeps precision
    uint256 waive = (m.totalTaxAmount * m.totalPlasticReused * SCALE) / m.totalPlasticBought / SCALE;

    // --- Apply the changes ---
    if (waive > m.totalTaxAmount) {
        waive = m.totalTaxAmount; // safety: avoid underflow
    }

    m.totalTaxAmount -= waive;
    m.totalTaxWaivePending += waive;

    emit TaxWaiverCalculated(_manufacturer, waive);
}


//send tax to authority
function sendTaxToAuthority(address _authority) public onlyVerified {
    Participant storage m = participants[msg.sender];
    require(_roleEquals(m.role, "Factory"), "Only factories");

    uint256 taxInUSD = m.totalTaxAmount;
    require(taxInUSD > 0, "No tax due");

    // --- Conversion rate ---
    // Example: 1 USD = 1 ether (change this as needed)
    uint256 weiPerUSD = 1 ether;

    // Convert USD to Wei
    uint256 taxInWei = taxInUSD * weiPerUSD;

    require(address(this).balance >= taxInWei, "Insufficient contract balance");

    // --- Interaction: send tax to authority ---
    (bool sent, ) = payable(_authority).call{value: taxInWei}("");
    require(sent, "Transfer failed");

    // --- Effects ---
    m.totalTaxAmount = 0;

    // --- Emit Event ---
    emit RewardPaid(msg.sender, _authority, taxInWei);
}



    function profitCheck(uint256 _buyingPrice, uint256 _productId) public view returns (bool) {
        require(_productId < nextProductId, "Invalid product id");
        uint256 productCost = products[_productId].price;
        uint256 productCarryingCost = products[_productId].productCarryingCost;
        return (_buyingPrice <= (productCarryingCost + productCost));
    }

    // -------------------------
    // FALLBACK
    // -------------------------
    receive() external payable {}
}
