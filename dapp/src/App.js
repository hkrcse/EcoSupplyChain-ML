import React, { useEffect, useState,useCallback  } from "react";
import { ethers } from "ethers";
import "./App.css";
import QRCode from "qrcode";
import { QrReader } from 'react-qr-reader';
import { formatEther, parseEther } from "ethers";



// ----- Contract Details -----
const CONTRACT_ADDRESS = "0xcFe152085afDeF843206CF80263827cE9A651554";
const CONTRACT_ABI = [
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "who",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "role",
				"type": "string"
			}
		],
		"name": "ParticipantRegistered",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "manufacturer",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "PlasticReusedRecorded",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "productId",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "recycler",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "plasticReturned",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "reward",
				"type": "uint256"
			}
		],
		"name": "ProductRecycled",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "productId",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			}
		],
		"name": "ProductTransferred",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "productId",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "manufacturer",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "plasticAmount",
				"type": "uint256"
			}
		],
		"name": "ProductUploaded",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "RewardPaid",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "manufacturer",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "taxWaived",
				"type": "uint256"
			}
		],
		"name": "TaxWaiverCalculated",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "authority",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_manufacturer",
				"type": "address"
			}
		],
		"name": "authorityTaxWaiveToFactory",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_to",
				"type": "address"
			}
		],
		"name": "getFactoryProductTo",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "id",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "name",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "price",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "taxAmount",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "plasticAmount",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "productionDate",
						"type": "string"
					},
					{
						"internalType": "string",
						"name": "expiryDate",
						"type": "string"
					},
					{
						"internalType": "bytes",
						"name": "sign",
						"type": "bytes"
					},
					{
						"internalType": "address",
						"name": "manufacturer",
						"type": "address"
					},
					{
						"internalType": "address",
						"name": "currentOwner",
						"type": "address"
					},
					{
						"internalType": "bool",
						"name": "isRecycled",
						"type": "bool"
					},
					{
						"internalType": "uint256",
						"name": "productCarryingCost",
						"type": "uint256"
					}
				],
				"internalType": "struct RecyclingSupplyChain.Product[]",
				"name": "",
				"type": "tuple[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_id",
				"type": "uint256"
			}
		],
		"name": "getProductInfo",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "id",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "name",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "price",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "taxAmount",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "plasticAmount",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "productionDate",
						"type": "string"
					},
					{
						"internalType": "string",
						"name": "expiryDate",
						"type": "string"
					},
					{
						"internalType": "bytes",
						"name": "sign",
						"type": "bytes"
					},
					{
						"internalType": "address",
						"name": "manufacturer",
						"type": "address"
					},
					{
						"internalType": "address",
						"name": "currentOwner",
						"type": "address"
					},
					{
						"internalType": "bool",
						"name": "isRecycled",
						"type": "bool"
					},
					{
						"internalType": "uint256",
						"name": "productCarryingCost",
						"type": "uint256"
					}
				],
				"internalType": "struct RecyclingSupplyChain.Product",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "hasRecycled",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "nextProductId",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "participants",
		"outputs": [
			{
				"internalType": "string",
				"name": "role",
				"type": "string"
			},
			{
				"internalType": "bool",
				"name": "verified",
				"type": "bool"
			},
			{
				"internalType": "uint256",
				"name": "totalPlasticBought",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalPlasticReturned",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalPlasticReused",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalTaxWaivePending",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalTaxAmount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "stockCount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "rewardsClaimedWei",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "rewardsPending",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "productLists",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "id",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "name",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "price",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "taxAmount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "plasticAmount",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "productionDate",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "expiryDate",
				"type": "string"
			},
			{
				"internalType": "bytes",
				"name": "sign",
				"type": "bytes"
			},
			{
				"internalType": "address",
				"name": "manufacturer",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "currentOwner",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "isRecycled",
				"type": "bool"
			},
			{
				"internalType": "uint256",
				"name": "productCarryingCost",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "productMsgHash",
		"outputs": [
			{
				"internalType": "bytes",
				"name": "",
				"type": "bytes"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "products",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "id",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "name",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "price",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "taxAmount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "plasticAmount",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "productionDate",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "expiryDate",
				"type": "string"
			},
			{
				"internalType": "bytes",
				"name": "sign",
				"type": "bytes"
			},
			{
				"internalType": "address",
				"name": "manufacturer",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "currentOwner",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "isRecycled",
				"type": "bool"
			},
			{
				"internalType": "uint256",
				"name": "productCarryingCost",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_buyingPrice",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_productId",
				"type": "uint256"
			}
		],
		"name": "profitCheck",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_id",
				"type": "uint256"
			}
		],
		"name": "recycle",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_id",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "_wallet",
				"type": "address"
			}
		],
		"name": "recycleWaste",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "recyclingRewardRate",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_addr",
				"type": "address"
			},
			{
				"internalType": "string",
				"name": "_role",
				"type": "string"
			}
		],
		"name": "registerParticipant",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_authority",
				"type": "address"
			}
		],
		"name": "sendTaxToAuthority",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_id",
				"type": "uint256"
			},
			{
				"internalType": "bytes",
				"name": "_msgHash",
				"type": "bytes"
			}
		],
		"name": "setEthMsg",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_to",
				"type": "address"
			},
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "id",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "name",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "price",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "taxAmount",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "plasticAmount",
						"type": "uint256"
					},
					{
						"internalType": "string",
						"name": "productionDate",
						"type": "string"
					},
					{
						"internalType": "string",
						"name": "expiryDate",
						"type": "string"
					},
					{
						"internalType": "bytes",
						"name": "sign",
						"type": "bytes"
					},
					{
						"internalType": "address",
						"name": "manufacturer",
						"type": "address"
					},
					{
						"internalType": "address",
						"name": "currentOwner",
						"type": "address"
					},
					{
						"internalType": "bool",
						"name": "isRecycled",
						"type": "bool"
					},
					{
						"internalType": "uint256",
						"name": "productCarryingCost",
						"type": "uint256"
					}
				],
				"internalType": "struct RecyclingSupplyChain.Product",
				"name": "_info",
				"type": "tuple"
			}
		],
		"name": "setFactoryProductTo",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_id",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "_to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_carryingCost",
				"type": "uint256"
			}
		],
		"name": "transferProduct",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_name",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "_price",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_taxAmount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_plasticAmount",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "_productionDate",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_expiryDate",
				"type": "string"
			},
			{
				"internalType": "bytes",
				"name": "_sign",
				"type": "bytes"
			}
		],
		"name": "uploadProduct",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	}
];
const signatureContract_Address = '0xd24AC08795aDF4F80E78Aaf268748E06699eA546';
const signatureContractABI = [
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "_messageHash",
				"type": "bytes32"
			}
		],
		"name": "getEthSignMessageHash",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_message",
				"type": "string"
			}
		],
		"name": "getMessageHash",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "_ethSignedMessageHash",
				"type": "bytes32"
			},
			{
				"internalType": "bytes",
				"name": "_sig",
				"type": "bytes"
			}
		],
		"name": "recover",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_signer",
				"type": "address"
			},
			{
				"internalType": "string",
				"name": "_message",
				"type": "string"
			},
			{
				"internalType": "bytes",
				"name": "_sig",
				"type": "bytes"
			}
		],
		"name": "verify",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "pure",
		"type": "function"
	}
];

// Paste full ABI here (from your original file). For brevity in this example, 
// the ABI block was omitted. In your actual file, keep the ABI array as before.

function App() {
  const [wallet, setWallet] = useState("");
  const [role, setRole] = useState("");
  const [contract, setContract] = useState(null);
  const [participantData, setParticipantData] = useState(null);
  const [productId, setProductId] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshToggle, setRefreshToggle] = useState(false);

  // UI state for forms
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [regAddress, setRegAddress] = useState("");
  const [regRole, setRegRole] = useState("");

  const [uploadForm, setUploadForm] = useState({
    name: "",
    price: "",
    taxAmount: "",
    plasticAmount: "",
    productionDate: "",
    expiryDate: "",
    sign: ""
  });

  const [transferForm, setTransferForm] = useState({
    receiver: "",
    carryingCost: "0"
  });

  const [recycleForm, setRecycleForm] = useState({
    productId: ""
  });

  const [fundForm, setFundForm] = useState({
    amount: "0.01"
  });

  const [recordReuseAmount, setRecordReuseAmount] = useState("0");
  const [authoritySearchWallet, setAuthoritySearchWallet] = useState("");
  const [products, setProducts] = useState([]);
  const [receiver, setReceiver] = useState("");
  const [carryingCost, setCarryingCost] = useState("");

  const [qrProductId, setQrProductId] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [product, setProduct] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [manufacturerAddr, setManufacturerAddr] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [authorityAddress, setAuthorityAddress] = useState("");
  const [buyingPrice, setBuyingPrice] = useState("");
  const [result, setResult] = useState("");

  const [ethHash, setEthHash] = useState(""); // bytes32 hash
  const [signature, setSignature] = useState(""); // bytes signature
  const [recoveredAddress, setRecoveredAddress] = useState("");
  const [error, setError] = useState("");
  const [manufacturerAddr2, setManufacturerAddr2] = useState("");
  const [verified, setIsVerified] = useState(false);


  // ---------------------------
  // CONNECT WALLET (navbar kept intact)
  // ---------------------------
  const connectWallet = async () => {
    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        setWallet(accounts[0]);
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        setContract(contractInstance);
      } else {
        // Fallback to Ganache JsonRpcProvider
        const provider = new ethers.JsonRpcProvider("http://127.0.0.1:7545");
        const signer = provider.getSigner(0);
        setWallet(await signer.getAddress());
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        setContract(contractInstance);
      }

      loadParticipantData();
    } catch (err) {
      console.error(err);
      alert("Connection failed: " + (err?.message || err));
    }
  };

  const disconnectWallet = () => {
    setWallet("");
    setContract(null);
    setRole("");
    setParticipantData(null);
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", () => window.location.reload());
      // reload on chain changes to avoid provider mismatch
      window.ethereum.on("chainChanged", () => window.location.reload());
    }
  }, []);

  // ---------------------------
  // LOAD PARTICIPANT DATA
  // ---------------------------
  const loadParticipantDataForAuthority = async () => {
    if (!contract || !authoritySearchWallet) return;
    try {
      
      const data = await contract.participants(authoritySearchWallet);
      setParticipantData({
        role: data.role,
        verified: data.verified,
        totalPlasticBought: Number(data.totalPlasticBought),
        totalPlasticReturned: Number(data.totalPlasticReturned),
        totalPlasticReused: Number(data.totalPlasticReused),
        stockCount: Number(data.stockCount),
        rewardsClaimedWei: ethers.formatEther(data.rewardsClaimedWei),
        rewardsPending: ethers.formatEther(data.rewardsPending)
      });

      console.log(data.verified);
     
    } catch (err) {
      console.error("Failed to load participant data:", err);
    }
  };


  const loadParticipantData = async () => {
    if (!contract || !wallet) return;
    try {
      
      const data = await contract.participants(wallet);
      setParticipantData({
        role: data.role,
        verified: data.verified,
        totalPlasticBought: Number(data.totalPlasticBought),
        totalPlasticReturned: Number(data.totalPlasticReturned),
        totalPlasticReused: Number(data.totalPlasticReused),
        stockCount: Number(data.stockCount),
        rewardsClaimedWei: data.rewardsClaimedWei,
        totalTaxAmount: Number(data.totalTaxAmount)
      });
      if (wallet.toLowerCase() === '0x97c548e6cf5e1656172d350dfcc0463c551977fa')
      {
              setRole('Authority');
      }
      else
      {
      setRole(data.role);
      }
      console.log(data);

    } catch (err) {
      console.error("Failed to load participant data:", err);
    }
  };

  useEffect(() => {
    if (wallet && contract) loadParticipantData();
  }, [wallet, contract, refreshToggle]);

  // ---------------------------
  // CONTRACT ACTIONS (UI-friendly)
  // ---------------------------
  const handleRegisterParticipant = async (e) => {
    e?.preventDefault();
    if (!contract) return alert("Connect wallet first");
    if (!regAddress || !regRole) return alert("Provide address and role");
    try {
      setLoading(true);
      const tx = await contract.registerParticipant(regAddress, regRole);
      await tx.wait();
      alert("Participant registered ✅");
      setRegAddress("");
      setRegRole("");
      setShowRegisterForm(false);
      setRefreshToggle(!refreshToggle);
    } catch (err) {
      console.error(err);
      alert("Registration failed: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleUploadProduct = async (e) => {
    e?.preventDefault();
    if (!contract) return alert("Connect wallet first");
    try {
      setLoading(true);
      const n = Number(await contract.nextProductId());
      const msg = n+uploadForm.name + uploadForm.price + uploadForm.taxAmount + uploadForm.taxAmount + uploadForm.productionDate + uploadForm.expiryDate;
      console.log(msg);
      const providerBrowser = new ethers.BrowserProvider(window.ethereum);
      const signContractBrowser = new ethers.Contract(signatureContract_Address, signatureContractABI, providerBrowser);

      const msgHash = await signContractBrowser.getMessageHash(msg);
      const ethMsgHash = await signContractBrowser.getEthSignMessageHash(msgHash);
      
      const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [wallet.toLowerCase(), msgHash]
          });
      

      const tx = await contract.uploadProduct(
        uploadForm.name,
        Number(uploadForm.price),
        Number(uploadForm.taxAmount),
        Number(uploadForm.plasticAmount),
        uploadForm.productionDate,
        uploadForm.expiryDate,
        signature
      );
      await tx.wait();

      const tx2 = await contract.setEthMsg(n,ethMsgHash);
      tx2.wait();

      alert("Product uploaded ✅");
      setRefreshToggle(!refreshToggle);
    } catch (err) {
      console.error(err);
      alert("Upload failed: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleTransferProduct = async (e) => {
    e?.preventDefault();
    console.log(receiver,carryingCost);
    if (!contract) return alert("Connect wallet first");
    if (!productId) return alert("Enter product id");
    if (!receiver) return alert("Provide receiver address");
    if (!carryingCost) return alert("Provide carryingCost Amount");

    try {
      setLoading(true);
      console.log(receiver);
      const tx = await contract.transferProduct(Number(productId), receiver, Number(carryingCost));
      await tx.wait();
      alert("Product transferred ✅");
      setTransferForm({ receiver: "", carryingCost: "0" });
      setProductId("");
      setRefreshToggle(!refreshToggle);
    } catch (err) {
      console.error(err);
      alert("Transfer failed: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };
//   const handleTransferProduct = async (e) => {
//   e.preventDefault();
//   try {
//     setLoading(true);
//     const tx = await contract.transferProduct(
//       parseInt(productId),
//       receiver,
//       parseInt(carryingCost)
//     );
//     await tx.wait();
//     alert("Product transferred successfully");
//   } catch (error) {
//     console.error(error);
//     alert("Transfer failed");
//   }
//   setLoading(false);
// };
const handleMarkRecycled = async (e) => {
  e?.preventDefault();
  if (!contract) return alert("⚠️ Please connect your wallet first.");

  const id = recycleForm.productId?.trim();
  const wallet = recycleForm.walletAddress?.trim();

  if (!id || !wallet) return alert("❗ Please provide both Product ID and Wallet Address.");

  try {
    setLoading(true);
    setStatusMessage("⏳ Processing transaction...");
    
    const rewardAmount = ethers.parseEther("10"); // example deposit
    const tx = await contract.recycleWaste(id, wallet, { value: rewardAmount });
    await tx.wait();

    setStatusMessage("✅ Product recycled successfully! Rewards sent.");
    setRecycleForm({ productId: "", walletAddress: "" });
    setRefreshToggle((prev) => !prev);
  } catch (err) {
    console.error(err);
    const errorMsg = err?.reason || err?.data?.message || err?.message || "Transaction failed.";
    setStatusMessage("❌ " + errorMsg);
  } finally {
    setLoading(false);
  }
};

async function handleTaxWaive(e) {
  e.preventDefault();
  setStatus("");
  setLoading(true);

  try {
    const tx = await contract.authorityTaxWaiveToFactory(manufacturerAddr);
    setStatus("Transaction sent... waiting for confirmation ⏳");
    await tx.wait();

    setStatus("✅ Tax waived successfully for the manufacturer!");
    setManufacturerAddr("");
  } catch (err) {
    console.error(err);
    if (err.reason) setStatus(`❌ Error: ${err.reason}`);
    else if (err.message) setStatus(`❌ ${err.message}`);
    else setStatus("❌ Transaction failed.");
  } finally {
    setLoading(false);
  }
}
const handleSendTax = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const tx = await contract.sendTaxToAuthority(authorityAddress);
      setMessage("⏳ Transaction submitted. Waiting for confirmation...");

      await tx.wait();
      setMessage("✅ Tax successfully sent to authority!");
    } catch (error) {
      console.error(error);
      setMessage(`❌ Error: ${error.reason || error.message}`);
    } finally {
      setLoading(false);
    }
  };
   const handleProfitCheck = async (e) => {
    e.preventDefault();
    setResult("");
    setLoading(true);

    try {
  
      // Call the view function (no gas)
      const isValid = await contract.profitCheck(buyingPrice,productId);

      if (isValid) {
        setResult("✅ The buying price is within the allowed profit margin.");
      } else {
        setResult("⚠️ The buying price exceeds the allowed profit margin!");
      }
    } catch (error) {
      console.error(error);
      setResult(`❌ Error: ${error.reason || error.message}`);
    } finally {
      setLoading(false);
    }
  };
  const handleRecover = async (e) => {
    e.preventDefault();
    setRecoveredAddress("");
    setError("");
    setLoading(true);
    setProductId("");

    try {    
      const data = await contract.getProductInfo(productId);
      console.log(data);
      setManufacturerAddr2(data[8]);

      setSignature(data[7]);
      setEthHash(await contract.productMsgHash(Number(productId)));
      
      // Call recover() (pure view function)
      const providerBrowser = new ethers.BrowserProvider(window.ethereum);
      const signContractBrowser = new ethers.Contract(signatureContract_Address, signatureContractABI, providerBrowser);
      const address = await signContractBrowser.recover(ethHash, signature);
      setRecoveredAddress(address);
      console.log(manufacturerAddr,signature,ethHash,recoveredAddress);

      if(address === manufacturerAddr2)
      {
        setIsVerified(true);
      }
      
    } catch (err) {
      console.error(err);
      setError(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  };
  // const handleMarkRecycled = async (e) => {
  //   e?.preventDefault();
  //   if (!contract) return alert("Connect wallet first");
  //   const id = recycleForm.productId || productId;
  //   if (!id) return alert("Provide product id to recycle");
  //   try {
  //     setLoading(true);
  //     const tx = await contract.markRecycled(Number(id));
  //     await tx.wait();
  //     alert("Product recycled ✅");
  //     setRecycleForm({ productId: "" });
  //     setProductId("");
  //     setRefreshToggle(!refreshToggle);
  //   } catch (err) {
  //     console.error(err);
  //     alert("Recycling failed: " + (err?.message || err));
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const handleFundRewards = async (e) => {
    e?.preventDefault();
    if (!contract) return alert("Connect wallet first");
    try {
      setLoading(true);
      const tx = await contract.fundRewards({ value: ethers.parseEther(fundForm.amount) });
      await tx.wait();
      alert("Rewards funded ✅");
      setFundForm({ amount: "0.01" });
      setRefreshToggle(!refreshToggle);
    } catch (err) {
      console.error(err);
      alert("Funding failed: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPlasticReused = async (e) => {
    e?.preventDefault();
    if (!contract) return alert("Connect wallet first");
    if (!recordReuseAmount) return alert("Enter amount");
    try {
      setLoading(true);
      const tx = await contract.recordPlasticReused(Number(recordReuseAmount));
      await tx.wait();
      alert("Plastic reuse recorded ✅");
      setRecordReuseAmount("0");
      setRefreshToggle(!refreshToggle);
    } catch (err) {
      console.error(err);
      alert("Operation failed: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleGetPendingTaxWaive = async () => {
    if (!contract) return alert("Connect wallet first");
    try {
      const waive = await contract.getPendingTaxWaive(wallet);
      // it's a uint (wei?), contract uses uint amounts; we treat as wei -> formatEther
      try {
        alert(`Pending Tax Waiver: ${ethers.formatEther(waive)} ETH`);
      } catch {
        // if it's not wei, show raw
        alert(`Pending Tax Waiver (raw): ${waive.toString()}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to fetch tax waiver: " + (err?.message || err));
    }
  };
  const handleRecycle = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {

      const tx = await contract.recycle(productId);
      setMessage("⏳ Transaction submitted. Please wait for confirmation...");

      await tx.wait();
      setMessage("✅ Recycling successful!");
    } catch (error) {
      console.error(error);
      setMessage(`❌ Error: ${error.reason || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------
  // UI helpers
  // ---------------------------
  const shortAddress = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "");

  // A small card style used below (inline CSS to avoid extra files)
  const cardStyle = {
    background: "white",
    padding: "1rem",
    borderRadius: "10px",
    boxShadow: "0 6px 18px rgba(20,20,20,0.08)"
  };
const loadProducts = async () => {
    try {

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contractIn = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      console.log(wallet);
      const fetched = await contractIn.getFactoryProductTo(wallet);
      console.log(fetched)
      setProducts(fetched);
    } catch (err) {
      console.error(err);
    }
  };
 

  const generateQrCode = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contractIn = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const fetched = await contractIn.getProductInfo(qrProductId);

   


          // Make QR data small & readable
      const data = JSON.stringify({
        id: fetched[0].toString(),           // BigInt → string
        name: fetched[1],
        price: Number(fetched[2]),           // assuming fits in Number safely
        taxAmount: Number(fetched[3]),
        plasticAmount: Number(fetched[4]),
        productionDate: fetched[5],
        expiryDate: fetched[6],
        sign: fetched[7],
        manufacturer: fetched[8],
        currentOwner: fetched[9],
        isRecycled: fetched[10],
      });


          const qrDataUrl = await QRCode.toDataURL(data, {
            width: 200,
            margin: 2,
          });

          setQrImage(qrDataUrl);

     
    } catch (error) {
      console.error("QR generation failed:", error);
    }
  };
//  const handleScan = (res) => {
//     if (res) {
//       try {
//         const parsed = JSON.parse(res.text);
//         setProduct(parsed);
//       } catch (err) {
//         console.log("Invalid QR Data", err);
//       }
//     }
//   };
   const handleScan = useCallback((result, error) => {
    if (result) {
      // Assume result.text contains the scanned QR data (fetch product info as needed)
      // For demo: just use JSON.parse for a JSON string QR, adapt to your backend as needed
      try {
        const productData = JSON.parse(result.text);
        setProduct(productData);
        setCameraActive(false); // Optional: Stop camera after successful scan
      } catch (e) {
        setProduct({ id: result.text, name: "Unknown Product" });
      }
    }
  }, []);

  
const renderRolePanel = () => {
  const sectionStyle = {
    background: "#fff",
    padding: "1rem",
    borderRadius: "12px",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem"
  };

  const labelStyle = { fontSize: "0.85rem", fontWeight: "500", color: "#333" };
  const inputStyle = {
    padding: "0.5rem",
    border: "1px solid #ccc",
    borderRadius: "8px",
    fontSize: "0.9rem",
  };
  const buttonPrimary = {
    background: "#2563eb",
    color: "white",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontSize: "0.9rem"
  };
  const buttonSecondary = {
    background: "#e5e7eb",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontSize: "0.9rem"
  };
  const styles = {
  card: {
    display: "flex",
    alignItems: "center",
    width: "auto",
    margin: "20px auto",
    padding: "20px",
    borderRadius: "15px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    backgroundColor: "#fff",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  info: {
    textAlign: "left",
  },
  title: {
    margin: "0 0 10px 0",
    color: "#333",
  },
};

  if (role === "Authority") {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
      {/* 👤 Register New Participant */}
      <div style={sectionStyle}>
        <h3>👤 Register New Participant</h3>
        <p style={{ color: "#555", fontSize: "0.85rem" }}>Assign roles to new participants</p>
        <form onSubmit={handleRegisterParticipant} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={labelStyle}>Address</label>
          <input
            style={inputStyle}
            value={regAddress}
            onChange={e => setRegAddress(e.target.value)}
            placeholder="0x..."
          />

          <label style={labelStyle}>Role</label>
          <input
            style={inputStyle}
            value={regRole}
            onChange={e => setRegRole(e.target.value)}
            placeholder="Factory / Supplier / Store / Buyer"
          />

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button style={buttonPrimary} type="submit" disabled={loading}>
              {loading ? "Registering..." : "Register"}
            </button>
            <button
              style={buttonSecondary}
              type="button"
              onClick={() => {
                setRegAddress("");
                setRegRole("");
              }}
            >
              Clear
            </button>
          </div>
        </form>
    </div>
         
  {/* 💰 Authority Tax Waive Section */}
<div style={sectionStyle}>
  <h3>💰 Authority Tax Waive</h3>
  <p style={{ color: "#555", fontSize: "0.85rem" }}>
    Waive factory tax based on recycled plastic ratio
  </p>

  <form onSubmit={handleTaxWaive} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
    <label style={labelStyle}>Manufacturer Address</label>
    <input
      style={inputStyle}
      value={manufacturerAddr}
      onChange={(e) => setManufacturerAddr(e.target.value)}
      placeholder="0xManufacturerAddress"
    />

    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
      <button style={buttonPrimary} type="submit" disabled={loading}>
        {loading ? "Processing..." : "Waive Tax"}
      </button>
      <button
        style={buttonSecondary}
        type="button"
        onClick={() => {
          setManufacturerAddr("");
          setStatus("");
        }}
      >
        Clear
      </button>
    </div>
  </form>

  {status && (
    <p style={{ marginTop: "0.5rem", color: "#007b00", fontSize: "0.85rem" }}>
      {status}
    </p>
  )}
</div>

      {/* 📊 Participant Snapshot */}
      <div style={sectionStyle}>
        <h3>📊 Participant Snapshot</h3>
        <p style={{ color: "#555", fontSize: "0.85rem" }}>View summary of participant data</p>
        <input
            style={inputStyle}
            value={authoritySearchWallet}
            onChange={e => setAuthoritySearchWallet(e.target.value)}
            placeholder="Enter Participants Wallet Address"
          />
        <button onClick={loadParticipantDataForAuthority} style={{ ...buttonPrimary, marginTop: "0.5rem" }}>
          Refresh Data
        </button>

          {participantData && (
          <div style={{ marginTop: 20, ...cardStyle }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 10 }}>
              <div>
                <p><strong>Role:</strong> {participantData.role}</p>
                <p><strong>Verified:</strong> {participantData.verified ? "✅" : "❌"}</p>
                <p><strong>Stock Count:</strong> {participantData.stockCount}</p>
              </div>
              <div>
                <p><strong>Total Plastic Bought:</strong> {participantData.totalPlasticBought}</p>
                <p><strong>Total Plastic Returned:</strong> {participantData.totalPlasticReturned}</p>
                <p><strong>Total Plastic Reused:</strong> {participantData.totalPlasticReused}</p>
              </div>
              <div>
                <p><strong>Rewards Claimed:</strong> {participantData.rewardsClaimedWei} ETH</p>
                <p><strong>Rewards Pending:</strong> {participantData.rewardsPending} ETH</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}

else if (role === "Factory") {
  return (
        <>
    <div style={styles.card}>
      <h2 style={styles.title}>Profile</h2>
      <p><strong>Role:</strong> {participantData.role}</p>
      <p><strong>Verified:</strong> {participantData.verified ? "Yes ✅" : "No ❌"}</p>
      <p><strong>Total Plastic Bought:</strong> {participantData.totalPlasticBought} kg</p>
      <p><strong>Total Plastic Returned:</strong> {participantData.totalPlasticReturned} kg</p>
      <p><strong>Total Plastic Reused:</strong> {participantData.totalPlasticReused} kg</p>
      <p><strong>Stock Count:</strong> {participantData.stockCount}</p>
      <p><strong>Rewards Claimed:</strong> {participantData.rewardsClaimed} ETH</p>
      <p><strong>Total Tax Amount:</strong> {participantData.totalTaxAmount} $</p>
    </div>
         {/* ♻️ Buyer Recycle Product */}
  <div style={sectionStyle}>
    <h3>♻️ Recycle Product</h3>
    <p style={{ color: "#555", fontSize: "0.85rem" }}>
      Enter the Product ID and wallet address to mark it as recycled and claim your rewards.
    </p>

    <form
      onSubmit={handleMarkRecycled}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        marginTop: "0.5rem",
      }}
    >
      {/* Product ID Input */}
      <input
        type="number"
        name="productId"
        style={{
          ...inputStyle,
          padding: "0.6rem",
          border: "1px solid #ccc",
          borderRadius: "8px",
          fontSize: "0.9rem",
        }}
        placeholder="Enter Product ID"
        value={recycleForm.productId || ""}
        onChange={(e) =>
          setRecycleForm((prev) => ({ ...prev, productId: e.target.value }))
        }
        required
      />

      {/* Wallet Address Input */}
      <input
        type="text"
        name="walletAddress"
        style={{
          ...inputStyle,
          padding: "0.6rem",
          border: "1px solid #ccc",
          borderRadius: "8px",
          fontSize: "0.9rem",
        }}
        placeholder="Enter Current Owner Wallet Address (0x...)"
        value={recycleForm.walletAddress || ""}
        onChange={(e) =>
          setRecycleForm((prev) => ({ ...prev, walletAddress: e.target.value }))
        }
        required
      />

      {/* Submit Button */}
      <button
        style={{
          ...buttonPrimary,
          padding: "0.6rem 1rem",
          fontWeight: "600",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "0.2s ease",
        }}
        type="submit"
        disabled={loading}
      >
        {loading ? "Processing..." : "Recycle Product"}
      </button>

      {/* Status Message */}
      {statusMessage && (
        <p
          style={{
            marginTop: "0.5rem",
            color: statusMessage.includes("✅") ? "green" : "red",
            fontSize: "0.85rem",
          }}
        >
          {statusMessage}
        </p>
      )}
    </form>
  </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        {/* 🏭 Upload Product */}
        <div style={sectionStyle}>
          <h3>🏭 Upload Product</h3>
          <p style={{ color: "#555", fontSize: "0.85rem" }}>Provide product details and upload</p>
          <form
            onSubmit={handleUploadProduct}
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {[
              { key: "name", label: "Product Name" },
              { key: "price", label: "Price ($)" },
              { key: "taxAmount", label: "Tax Amount ($)" },
              { key: "plasticAmount", label: "Plastic Amount (gm)" },
              { key: "productionDate", label: "Production Date(yy-mm-dd)" },
              { key: "expiryDate", label: "Expiry Date(yy-mm-dd)" },
            ].map(({ key, label }) => (
              <input
                key={key}
                name={key}
                style={inputStyle}
                value={uploadForm[key] || ""}
                placeholder={label}
                onChange={(e) => setUploadForm({ ...uploadForm, [key]: e.target.value })}
                required />
            ))}

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button style={buttonPrimary} type="submit" disabled={loading}>
                {loading ? "Uploading..." : "Upload"}
              </button>

              <button
                style={buttonSecondary}
                type="button"
                onClick={() => setUploadForm({
                  name: "",
                  price: "",
                  taxAmount: "",
                  plasticAmount: "",
                  productionDate: "",
                  expiryDate: "",
                  sign: "",
                })}
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Transfer Product */}
        <div style={sectionStyle}>
          <h3>📦 Transfer Product</h3>
          <p style={{ color: "#555", fontSize: "0.85rem" }}>
            Transfer ownership of the product to a verified participant
          </p>

          <form onSubmit={handleTransferProduct} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>

            <input
              style={inputStyle}
              placeholder="Product ID"
              value={productId}
              onChange={e => setProductId(e.target.value)}
              required />

            <input
              style={inputStyle}
              placeholder="Receiver Wallet Address"
              value={receiver}
              onChange={e => setReceiver(e.target.value)}
              required />

            <input
              style={inputStyle}
              placeholder="Carrying Cost[$]"
              value={carryingCost}
              onChange={e => setCarryingCost(e.target.value)}
              required />

            <button style={buttonPrimary} type="submit" disabled={loading}>
              {loading ? "Processing..." : "Transfer"}
            </button>
          </form>
        </div>

  <div style={{
      maxWidth: "600px",
      margin: "40px auto",
      padding: "20px",
      borderRadius: "12px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
      textAlign: "center"
    }}>
    <h2>♻️ Reuse Product</h2>
      <form onSubmit={handleRecycle} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <input
          type="number"
          placeholder="Enter Product ID"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          required
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "1rem"
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "1rem",
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Recycling..." : "Recycle"}
        </button>
      </form>

      {message && (
        <p style={{
          marginTop: "15px",
          color: message.startsWith("✅") ? "green" : message.startsWith("❌") ? "red" : "#555"
        }}>
          {message}
        </p>
      )}
    </div>
    <div
      style={{
        maxWidth: "420px",
        margin: "40px auto",
        padding: "25px",
        borderRadius: "12px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
        textAlign: "center",
      }}
    >
      <h2>🏛️ Send Tax to Authority</h2>
      <form
        onSubmit={handleSendTax}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <input
          type="text"
          placeholder="Enter Authority Address"
          value={authorityAddress}
          onChange={(e) => setAuthorityAddress(e.target.value)}
          required
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "1rem",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px",
            backgroundColor: "#1E88E5",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "1rem",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending..." : "Send Tax"}
        </button>
      </form>

      {message && (
        <p
          style={{
            marginTop: "15px",
            color:
              message.startsWith("✅")
                ? "green"
                : message.startsWith("❌")
                ? "red"
                : "#555",
          }}
        >
          {message}
        </p>
      )}
    </div>

        <div style={{ marginTop: 20 }}>
          <button
            onClick={loadProducts}
            style={{ padding: "10px 18px", borderRadius: 8, background: "#007bff", color: "#fff", border: "none" }}
          >
            🔄 Load Products
          </button>

          {products.length > 0 ? (
            <div style={{ marginTop: 20 }}>
              <h3>📦 Assigned Products</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
                {products.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    }}
                  >
                    <p><strong>ID:</strong> {p.id?.toString()}</p>
                    <p><strong>Name:</strong> {p.name}</p>
                    <p><strong>Price:</strong> {p.price?.toString()} $</p>
                    <p><strong>Tax Amount:</strong> {p.taxAmount?.toString()} $</p>
                    <p><strong>Plastic Amount:</strong> {p.plasticAmount?.toString()} gm</p>
                    <p><strong>Production Date:</strong> {p.productionDate}</p>
                    <p><strong>Expiry Date:</strong> {p.expiryDate}</p>
                    <p><strong>Manufacturer:</strong> {p.manufacturer}</p>
                    <p><strong>Current Owner:</strong> {p.currentOwner}</p>
                    <p><strong>Recycled:</strong> {p.isRecycled ? "✅ Yes" : "❌ No"}</p>
                    <p><strong>Product Carrying Cost:</strong> {p.productCarryingCost?.toString()} $</p>
                  </div>
                ))}

              </div>
            </div>
          ) : (
            <p style={{ marginTop: 20, color: "#555" }}>No products found.</p>
          )}
        </div>
        {/* Generate QR Code */}
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 20,
            marginTop: 20,
            background: "#f9f9f9",
          }}
        >
          <h3>🔳 Generate Product QR Code</h3>
          <p style={{ color: "#555", fontSize: "0.85rem" }}>
            Enter Product ID to generate a QR code
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #ccc",
              }}
              placeholder="Enter Product ID"
              value={qrProductId}
              onChange={(e) => setQrProductId(e.target.value)} />

            <button
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "#007bff",
                color: "#fff",
                border: "none",
              }}
              onClick={generateQrCode}
              disabled={!qrProductId}
            >
              Generate QR
            </button>

            {qrImage && (
              <div style={{ textAlign: "center", marginTop: "1rem" }}>
                <img
                  src={qrImage}
                  alt="QR Code"
                  width="180"
                  height="180"
                  style={{ borderRadius: 8, border: "1px solid #ccc" }} />
                <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                  Product ID: <strong>{qrProductId}</strong>
                </p>

                {/* Download Button */}
                <button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = qrImage;
                    link.download = `product_${qrProductId}_QR.png`;
                    link.click();
                  } }
                  style={{
                    marginTop: "0.5rem",
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "#28a745",
                    color: "#fff",
                    border: "none",
                  }}
                >
                  ⬇️ Download QR
                </button>
              </div>
            )}
          </div>
        </div>


      </div></>
 
  );
}

else if (role === "Supplier") {
  return (
        <>
    <div style={styles.card}>
      <h2 style={styles.title}>Profile</h2>
      <p><strong>Role:</strong> {participantData.role}</p>
      <p><strong>Verified:</strong> {participantData.verified ? "Yes ✅" : "No ❌"}</p>
      <p><strong>Total Plastic Bought:</strong> {participantData.totalPlasticBought} kg</p>
      <p><strong>Total Plastic Returned:</strong> {participantData.totalPlasticReturned} kg</p>
      <p><strong>Total Plastic Reused:</strong> {participantData.totalPlasticReused} kg</p>
      <p><strong>Stock Count:</strong> {participantData.stockCount}</p>
       <p>
        <strong>Rewards Claimed:</strong>{" "}
        {participantData?.rewardsClaimedWei
          ? participantData.rewardsClaimedWei.toString()
          : "0"}{" "}
        Wei
      </p>      
      {/* <p><strong>Rewards Pending:</strong> {participantData.rewardsPending.toString()} Wei</p> */}
      <p>
        <strong>Rewards Pending:</strong>{" "}
        {participantData?.rewardsPending
          ? participantData.rewardsPending.toString()
          : "0"}{" "}
        Wei
      </p> 
    </div>
     {/* ♻️ Buyer Recycle Product */}
  <div style={sectionStyle}>
    <h3>♻️ Recycle Product</h3>
    <p style={{ color: "#555", fontSize: "0.85rem" }}>
      Enter the Product ID and wallet address to mark it as recycled and claim your rewards.
    </p>

    <form
      onSubmit={handleMarkRecycled}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        marginTop: "0.5rem",
      }}
    >
      {/* Product ID Input */}
      <input
        type="number"
        name="productId"
        style={{
          ...inputStyle,
          padding: "0.6rem",
          border: "1px solid #ccc",
          borderRadius: "8px",
          fontSize: "0.9rem",
        }}
        placeholder="Enter Product ID"
        value={recycleForm.productId || ""}
        onChange={(e) =>
          setRecycleForm((prev) => ({ ...prev, productId: e.target.value }))
        }
        required
      />

      {/* Wallet Address Input */}
      <input
        type="text"
        name="walletAddress"
        style={{
          ...inputStyle,
          padding: "0.6rem",
          border: "1px solid #ccc",
          borderRadius: "8px",
          fontSize: "0.9rem",
        }}
        placeholder="Enter Current Owner Wallet Address (0x...)"
        value={recycleForm.walletAddress || ""}
        onChange={(e) =>
          setRecycleForm((prev) => ({ ...prev, walletAddress: e.target.value }))
        }
        required
      />

      {/* Submit Button */}
      <button
        style={{
          ...buttonPrimary,
          padding: "0.6rem 1rem",
          fontWeight: "600",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "0.2s ease",
        }}
        type="submit"
        disabled={loading}
      >
        {loading ? "Processing..." : "Recycle Product"}
      </button>

      {/* Status Message */}
      {statusMessage && (
        <p
          style={{
            marginTop: "0.5rem",
            color: statusMessage.includes("✅") ? "green" : "red",
            fontSize: "0.85rem",
          }}
        >
          {statusMessage}
        </p>
      )}
    </form>
  </div>
    
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        {/* Transfer Product */}
        <div style={sectionStyle}>
          <h3>📦 Transfer Product</h3>
          <p style={{ color: "#555", fontSize: "0.85rem" }}>
            Transfer ownership of the product to a verified participant
          </p>

          <form onSubmit={handleTransferProduct} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>

            <input
              style={inputStyle}
              placeholder="Product ID"
              value={productId}
              onChange={e => setProductId(e.target.value)}
              required />

            <input
              style={inputStyle}
              placeholder="Receiver Wallet Address"
              value={receiver}
              onChange={e => setReceiver(e.target.value)}
              required />

            <input
              style={inputStyle}
              placeholder="Carrying Cost[$]"
              value={carryingCost}
              onChange={e => setCarryingCost(e.target.value)}
              required />

            <button style={buttonPrimary} type="submit" disabled={loading}>
              {loading ? "Processing..." : "Transfer"}
            </button>
          </form>
        </div>
    <div
      style={{
        maxWidth: "450px",
        margin: "40px auto",
        padding: "25px",
        borderRadius: "12px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
        textAlign: "center",
      }}
    >
      <h2>💰 Profit Margin Check</h2>
      <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "10px" }}>
        Verify if a buying price stays within the allowed limit for a product.
      </p>

      <form
        onSubmit={handleProfitCheck}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <input
          type="number"
          placeholder="Enter Product ID"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          required
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "1rem",
          }}
        />

        <input
          type="text"
          placeholder="Enter Buying Price (in ETH)"
          value={buyingPrice}
          onChange={(e) => setBuyingPrice(e.target.value)}
          required
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "1rem",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px",
            backgroundColor: "#2E7D32",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "1rem",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Checking..." : "Check Profit"}
        </button>
      </form>

      {result && (
        <p
          style={{
            marginTop: "15px",
            color:
              result.startsWith("✅")
                ? "green"
                : result.startsWith("⚠️")
                ? "#E65100"
                : "red",
            fontWeight: "500",
          }}
        >
          {result}
        </p>
      )}
    </div>
     <div
      style={{
        maxWidth: 500,
        margin: "40px auto",
        padding: "25px",
        borderRadius: "12px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
      }}
    >
      <h2 style={{ textAlign: "center" }}>✅ Product Authenticity Check</h2>
      <p style={{ color: "#555", fontSize: "0.9rem", textAlign: "center" }}>
        Use <code>recover(bytes32, bytes)</code> to get the signer address.
      </p>

      <form onSubmit={handleRecover} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
             <div>
          <label style={{ fontWeight: "500" }}>Product Id</label>
          <input
            type="text"
            value={productId}
            onChange={(e) => setProductId(e.target.value.trim())}
            placeholder="Product Id"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontFamily: "monospace",
            }}
            required
          />
        </div>


        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: "#1976D2",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {loading ? "Verifying Product..." : "Verify Product"}
        </button>
      </form>

      {verified && (
        <p
          style={{
            marginTop: "20px",
            color: "green",
            textAlign: "center",
            fontFamily: "monospace",
          }}
        >
          ✅ Product is Verified: {recoveredAddress}
        </p>
      )}

      {error && (
        <p style={{ marginTop: "15px", color: "red", textAlign: "center" }}>
          ❌ {error}
        </p>
      )}
    </div>
        <div style={{ marginTop: 20 }}>
          <button
            onClick={loadProducts}
            style={{ padding: "10px 18px", borderRadius: 8, background: "#007bff", color: "#fff", border: "none" }}
          >
            🔄 Load Products
          </button>

          {products.length > 0 ? (
            <div style={{ marginTop: 20 }}>
              <h3>📦 Assigned Products</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
                {products.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    }}
                  >
                    <p><strong>ID:</strong> {p.id?.toString()}</p>
                    <p><strong>Name:</strong> {p.name}</p>
                    <p><strong>Price:</strong> {p.price?.toString()} $</p>
                    <p><strong>Tax Amount:</strong> {p.taxAmount?.toString()} $</p>
                    <p><strong>Plastic Amount:</strong> {p.plasticAmount?.toString()} gm</p>
                    <p><strong>Production Date:</strong> {p.productionDate}</p>
                    <p><strong>Expiry Date:</strong> {p.expiryDate}</p>
                    <p><strong>Manufacturer:</strong> {p.manufacturer}</p>
                    <p><strong>Current Owner:</strong> {p.currentOwner}</p>
                    <p><strong>Recycled:</strong> {p.isRecycled ? "✅ Yes" : "❌ No"}</p>
                    <p><strong>Product Carrying Cost:</strong> {p.productCarryingCost?.toString()} $</p>
                  </div>
                ))}

              </div>
            </div>
          ) : (
            <p style={{ marginTop: 20, color: "#555" }}>No products found.</p>
          )}
        </div>

      </div>
      
 <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }}>
      <h2 style={{ marginBottom: 20 }}>QR Scanner</h2>

      {/* Camera Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => setCameraActive(true)}
          disabled={cameraActive}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#1976d2",
            color: "#fff",
            cursor: cameraActive ? "not-allowed" : "pointer"
          }}
        >
          Start Camera
        </button>
        <button
          onClick={() => setCameraActive(false)}
          disabled={!cameraActive}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#f44336",
            color: "#fff",
            cursor: !cameraActive ? "not-allowed" : "pointer"
          }}
        >
          Stop Camera
        </button>
      </div>

      {/* Scanner Card */}
      <div
        style={{
          width: "360px",
          borderRadius: "15px",
          overflow: "hidden",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          marginBottom: 20,
          minHeight: 270,
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {cameraActive && (
          <QrReader
            scanDelay={200}
            constraints={{ facingMode: "user" }}
            onResult={handleScan}
            style={{ width: "100%" }}
          />
        )}
        {!cameraActive && <span style={{ color: "#fff" }}>Camera is stopped</span>}
      </div>

      {/* Product Details Card */}
      {product ? (
        <div
          style={{
            width: "360px",
            borderRadius: "15px",
            padding: "20px",
            backgroundColor: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            textAlign: "left",
          }}
        >
          <h3 style={{ marginBottom: 15 }}>Product Details</h3>
          <p><strong>ID:</strong> {product.id}</p>
          <p><strong>Name:</strong> {product.name}</p>
          {/* <p><strong>Price:</strong> ${product.price}</p> */}
          <p><strong>Tax Amount:</strong> ${product.taxAmount}</p>
          <p><strong>Plastic Amount:</strong> {product.plasticAmount} g</p>
          <p><strong>Production Date:</strong> {product.productionDate}</p>
          <p><strong>Expiry Date:</strong> {product.expiryDate}</p>
          <p><strong>Manufacturer:</strong> {product.manufacturer}</p>
          <p><strong>Current Owner:</strong> {product.currentOwner}</p>
          {/* <p><strong>Recycled:</strong> {product.isRecycled ? "✅ Yes" : "❌ No"}</p>
          <p
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontSize: "12px",
              marginTop: "8px"
            }}
          >
            <strong>Signature:</strong> {product.sign}
          </p> */}
        </div>
      ) : (
        <div
          style={{
            width: "360px",
            borderRadius: "15px",
            padding: "20px",
            backgroundColor: "#f9f9f9",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            textAlign: "center",
          }}
        >
          <p><strong>Scan a product QR code</strong></p>
        </div>
      )}
    </div>
      </>
  );
}

else if (role === "Store") {
  return (
        <>
    <div style={styles.card}>
      <h2 style={styles.title}>Profile</h2>
      <p><strong>Role:</strong> {participantData.role}</p>
      <p><strong>Verified:</strong> {participantData.verified ? "Yes ✅" : "No ❌"}</p>
      <p><strong>Total Plastic Bought:</strong> {participantData.totalPlasticBought} kg</p>
      <p><strong>Total Plastic Returned:</strong> {participantData.totalPlasticReturned} kg</p>
      <p><strong>Total Plastic Reused:</strong> {participantData.totalPlasticReused} kg</p>
      <p><strong>Stock Count:</strong> {participantData.stockCount}</p>
   <p>
        <strong>Rewards Claimed:</strong>{" "}
        {participantData?.rewardsClaimedWei
          ? participantData.rewardsClaimedWei.toString()
          : "0"}{" "}
        Wei
      </p>      
      {/* <p><strong>Rewards Pending:</strong> {participantData.rewardsPending.toString()} Wei</p> */}
      <p>
        <strong>Rewards Pending:</strong>{" "}
        {participantData?.rewardsPending
          ? participantData.rewardsPending.toString()
          : "0"}{" "}
        Wei
      </p> 
    </div>
   <div
        style={{
          display: "grid",
          gap: "1rem",
          marginTop: "1rem",
          width:"100%"
        }}
      >
        {/* ♻️ Buyer Recycle Product */}
        <div style={sectionStyle}>
          <h3>♻️ Recycle Product</h3>
          <p style={{ color: "#555", fontSize: "0.85rem" }}>
            Enter the Product ID and wallet address to mark it as recycled and claim your rewards.
          </p>

          <form
            onSubmit={handleMarkRecycled}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              marginTop: "0.5rem",
            }}
          >
            {/* Product ID Input */}
            <input
              type="number"
              name="productId"
              style={{
                ...inputStyle,
                padding: "0.6rem",
                border: "1px solid #ccc",
                borderRadius: "8px",
                fontSize: "0.9rem",
              }}
              placeholder="Enter Product ID"
              value={recycleForm.productId || ""}
              onChange={(e) =>
                setRecycleForm((prev) => ({ ...prev, productId: e.target.value }))
              }
              required
            />

            {/* Wallet Address Input */}
            <input
              type="text"
              name="walletAddress"
              style={{
                ...inputStyle,
                padding: "0.6rem",
                border: "1px solid #ccc",
                borderRadius: "8px",
                fontSize: "0.9rem",
              }}
              placeholder="Enter Current Owner Wallet Address (0x...)"
              value={recycleForm.walletAddress || ""}
              onChange={(e) =>
                setRecycleForm((prev) => ({ ...prev, walletAddress: e.target.value }))
              }
              required
            />

            {/* Submit Button */}
            <button
              style={{
                ...buttonPrimary,
                padding: "0.6rem 1rem",
                fontWeight: "600",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "0.2s ease",
              }}
              type="submit"
              disabled={loading}
            >
              {loading ? "Processing..." : "Recycle Product"}
            </button>

            {/* Status Message */}
            {statusMessage && (
              <p
                style={{
                  marginTop: "0.5rem",
                  color: statusMessage.includes("✅") ? "green" : "red",
                  fontSize: "0.85rem",
                }}
              >
                {statusMessage}
              </p>
            )}
          </form>
        </div>
      </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        {/* Transfer Product */}
        <div style={sectionStyle}>
          <h3>🏬 Transfer Product</h3>
          <p style={{ color: "#555", fontSize: "0.85rem" }}>
            Transfer ownership of the product to a verified participant
          </p>

          <form onSubmit={handleTransferProduct} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>

            <input
              style={inputStyle}
              placeholder="Product ID"
              value={productId}
              onChange={e => setProductId(e.target.value)}
              required />

            <input
              style={inputStyle}
              placeholder="Receiver Wallet Address"
              value={receiver}
              onChange={e => setReceiver(e.target.value)}
              required />

            <input
              style={inputStyle}
              placeholder="Carrying Cost[$]"
              value={carryingCost}
              onChange={e => setCarryingCost(e.target.value)}
              required />

            <button style={buttonPrimary} type="submit" disabled={loading}>
              {loading ? "Processing..." : "Transfer"}
            </button>
          </form>
        </div>
  <div
      style={{
        maxWidth: "450px",
        margin: "40px auto",
        padding: "25px",
        borderRadius: "12px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
        textAlign: "center",
      }}
    >
      <h2>💰 Profit Margin Check</h2>
      <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "10px" }}>
        Verify if a buying price stays within the allowed limit for a product.
      </p>

      <form
        onSubmit={handleProfitCheck}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <input
          type="number"
          placeholder="Enter Product ID"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          required
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "1rem",
          }}
        />

        <input
          type="text"
          placeholder="Enter Buying Price (in ETH)"
          value={buyingPrice}
          onChange={(e) => setBuyingPrice(e.target.value)}
          required
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "1rem",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px",
            backgroundColor: "#2E7D32",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "1rem",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Checking..." : "Check Profit"}
        </button>
      </form>

      {result && (
        <p
          style={{
            marginTop: "15px",
            color:
              result.startsWith("✅")
                ? "green"
                : result.startsWith("⚠️")
                ? "#E65100"
                : "red",
            fontWeight: "500",
          }}
        >
          {result}
        </p>
      )}
    </div>
     <div
      style={{
        maxWidth: 500,
        margin: "40px auto",
        padding: "25px",
        borderRadius: "12px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
      }}
    >
      <h2 style={{ textAlign: "center" }}>✅ Product Authenticity Check</h2>
      <p style={{ color: "#555", fontSize: "0.9rem", textAlign: "center" }}>
        Use <code>recover(bytes32, bytes)</code> to get the signer address.
      </p>

      <form onSubmit={handleRecover} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
             <div>
          <label style={{ fontWeight: "500" }}>Product Id</label>
          <input
            type="text"
            value={productId}
            onChange={(e) => setProductId(e.target.value.trim())}
            placeholder="Product Id"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontFamily: "monospace",
            }}
            required
          />
        </div>


        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: "#1976D2",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {loading ? "Verifying Product..." : "Verify Product"}
        </button>
      </form>

      {verified && (
        <p
          style={{
            marginTop: "20px",
            color: "green",
            textAlign: "center",
            fontFamily: "monospace",
          }}
        >
          ✅ Product is Verified: {recoveredAddress}
        </p>
      )}

      {error && (
        <p style={{ marginTop: "15px", color: "red", textAlign: "center" }}>
          ❌ {error}
        </p>
      )}
    </div>
        <div style={{ marginTop: 20 }}>
          <button
            onClick={loadProducts}
            style={{ padding: "10px 18px", borderRadius: 8, background: "#007bff", color: "#fff", border: "none" }}
          >
            🔄 Load Products
          </button>

          {products.length > 0 ? (
            <div style={{ marginTop: 20 }}>
              <h3>📦 Assigned Products</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
                {products.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    }}
                  >
                    <p><strong>ID:</strong> {p.id?.toString()}</p>
                    <p><strong>Name:</strong> {p.name}</p>
                    <p><strong>Price:</strong> {p.price?.toString()} $</p>
                    <p><strong>Tax Amount:</strong> {p.taxAmount?.toString()} $</p>
                    <p><strong>Plastic Amount:</strong> {p.plasticAmount?.toString()} gm</p>
                    <p><strong>Production Date:</strong> {p.productionDate}</p>
                    <p><strong>Expiry Date:</strong> {p.expiryDate}</p>
                    <p><strong>Manufacturer:</strong> {p.manufacturer}</p>
                    <p><strong>Current Owner:</strong> {p.currentOwner}</p>
                    <p><strong>Recycled:</strong> {p.isRecycled ? "✅ Yes" : "❌ No"}</p>
                    <p><strong>Product Carrying Cost:</strong> {p.productCarryingCost?.toString()} $</p>
                  </div>
                ))}

              </div>
            </div>
          ) : (
            <p style={{ marginTop: 20, color: "#555" }}>No products found.</p>
          )}
        </div>

      </div>
 <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }}>
      <h2 style={{ marginBottom: 20 }}>QR Scanner</h2>

      {/* Camera Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => setCameraActive(true)}
          disabled={cameraActive}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#1976d2",
            color: "#fff",
            cursor: cameraActive ? "not-allowed" : "pointer"
          }}
        >
          Start Camera
        </button>
        <button
          onClick={() => setCameraActive(false)}
          disabled={!cameraActive}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#f44336",
            color: "#fff",
            cursor: !cameraActive ? "not-allowed" : "pointer"
          }}
        >
          Stop Camera
        </button>
      </div>

      {/* Scanner Card */}
      <div
        style={{
          width: "360px",
          borderRadius: "15px",
          overflow: "hidden",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          marginBottom: 20,
          minHeight: 270,
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {cameraActive && (
          <QrReader
            scanDelay={200}
            constraints={{ facingMode: "user" }}
            onResult={handleScan}
            style={{ width: "100%" }}
          />
        )}
        {!cameraActive && <span style={{ color: "#fff" }}>Camera is stopped</span>}
      </div>

      {/* Product Details Card */}
      {product ? (
        <div
          style={{
            width: "360px",
            borderRadius: "15px",
            padding: "20px",
            backgroundColor: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            textAlign: "left",
          }}
        >
          <h3 style={{ marginBottom: 15 }}>Product Details</h3>
          <p><strong>ID:</strong> {product.id}</p>
          <p><strong>Name:</strong> {product.name}</p>
          {/* <p><strong>Price:</strong> ${product.price}</p> */}
          <p><strong>Tax Amount:</strong> ${product.taxAmount}</p>
          <p><strong>Plastic Amount:</strong> {product.plasticAmount} g</p>
          <p><strong>Production Date:</strong> {product.productionDate}</p>
          <p><strong>Expiry Date:</strong> {product.expiryDate}</p>
          <p><strong>Manufacturer:</strong> {product.manufacturer}</p>
          <p><strong>Current Owner:</strong> {product.currentOwner}</p>
          {/* <p><strong>Recycled:</strong> {product.isRecycled ? "✅ Yes" : "❌ No"}</p>
          <p
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontSize: "12px",
              marginTop: "8px"
            }}
          >
            <strong>Signature:</strong> {product.sign}
          </p> */}
        </div>
      ) : (
        <div
          style={{
            width: "360px",
            borderRadius: "15px",
            padding: "20px",
            backgroundColor: "#f9f9f9",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            textAlign: "center",
          }}
        >
          <p><strong>Scan a product QR code</strong></p>
        </div>
      )}
    </div>
      
      </>
    



  );
}

else if (role === "Buyer") {
  return (
    <>
  
    <div style={styles.card}>
      <h2 style={styles.title}>Profile</h2>
      <p><strong>Role:</strong> {participantData.role}</p>
      <p><strong>Verified:</strong> {participantData.verified ? "Yes ✅" : "No ❌"}</p>
      <p><strong>Total Plastic Bought:</strong> {participantData.totalPlasticBought} kg</p>
      <p><strong>Total Plastic Returned:</strong> {participantData.totalPlasticReturned} kg</p>
      <p><strong>Total Plastic Reused:</strong> {participantData.totalPlasticReused} kg</p>
      <p><strong>Stock Count:</strong> {participantData.stockCount}</p>
      <p>
        <strong>Rewards Claimed:</strong>{" "}
        {participantData?.rewardsClaimedWei
          ? participantData.rewardsClaimedWei.toString()
          : "0"}{" "}
        Wei
      </p>      
      {/* <p><strong>Rewards Pending:</strong> {participantData.rewardsPending.toString()} Wei</p> */}
      <p>
        <strong>Rewards Pending:</strong>{" "}
        {participantData?.rewardsPending
          ? participantData.rewardsPending.toString()
          : "0"}{" "}
        Wei
      </p> 
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
      {/* ♻️ Buyer Recycle Product */}
      <div style={sectionStyle}>
        <h3>♻️ Recycle Your Product to Store</h3>
      </div>
    </div>
    <div
      style={{
        maxWidth: "450px",
        margin: "40px auto",
        padding: "25px",
        borderRadius: "12px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
        textAlign: "center",
      }}
    >
      <h2>💰 Profit Margin Check</h2>
      <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "10px" }}>
        Verify if a buying price stays within the allowed limit for a product.
      </p>

      <form
        onSubmit={handleProfitCheck}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <input
          type="number"
          placeholder="Enter Product ID"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          required
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "1rem",
          }}
        />

        <input
          type="text"
          placeholder="Enter Buying Price (in ETH)"
          value={buyingPrice}
          onChange={(e) => setBuyingPrice(e.target.value)}
          required
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "1rem",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px",
            backgroundColor: "#2E7D32",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "1rem",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Checking..." : "Check Profit"}
        </button>
      </form>

      {result && (
        <p
          style={{
            marginTop: "15px",
            color:
              result.startsWith("✅")
                ? "green"
                : result.startsWith("⚠️")
                ? "#E65100"
                : "red",
            fontWeight: "500",
          }}
        >
          {result}
        </p>
      )}
    </div>
     <div
      style={{
        maxWidth: 500,
        margin: "40px auto",
        padding: "25px",
        borderRadius: "12px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
      }}
    >
      <h2 style={{ textAlign: "center" }}>✅ Product Authenticity Check</h2>
      <p style={{ color: "#555", fontSize: "0.9rem", textAlign: "center" }}>
        Use <code>recover(bytes32, bytes)</code> to get the signer address.
      </p>

      <form onSubmit={handleRecover} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
             <div>
          <label style={{ fontWeight: "500" }}>Product Id</label>
          <input
            type="text"
            value={productId}
            onChange={(e) => setProductId(e.target.value.trim())}
            placeholder="Product Id"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontFamily: "monospace",
            }}
            required
          />
        </div>


        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: "#1976D2",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {loading ? "Verifying Product..." : "Verify Product"}
        </button>
      </form>

      {verified && (
        <p
          style={{
            marginTop: "20px",
            color: "green",
            textAlign: "center",
            fontFamily: "monospace",
          }}
        >
          ✅ Product is Verified: {recoveredAddress}
        </p>
      )}

      {error && (
        <p style={{ marginTop: "15px", color: "red", textAlign: "center" }}>
          ❌ {error}
        </p>
      )}
    </div>
    <div style={{ marginTop: 20 }}>
          <button
            onClick={loadProducts}
            style={{ padding: "10px 18px", borderRadius: 8, background: "#007bff", color: "#fff", border: "none" }}
          >
            🔄 Load Products
          </button>

          {products.length > 0 ? (
            <div style={{ marginTop: 20 }}>
              <h3>📦 Assigned Products</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
                {products.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    }}
                  >
                    <p><strong>ID:</strong> {p.id?.toString()}</p>
                    <p><strong>Name:</strong> {p.name}</p>
                    <p><strong>Price:</strong> {p.price?.toString()} $</p>
                    <p><strong>Tax Amount:</strong> {p.taxAmount?.toString()} $</p>
                    <p><strong>Plastic Amount:</strong> {p.plasticAmount?.toString()} gm</p>
                    <p><strong>Production Date:</strong> {p.productionDate}</p>
                    <p><strong>Expiry Date:</strong> {p.expiryDate}</p>
                    <p><strong>Manufacturer:</strong> {p.manufacturer}</p>
                    <p><strong>Current Owner:</strong> {p.currentOwner}</p>
                    <p><strong>Recycled:</strong> {p.isRecycled ? "✅ Yes" : "❌ No"}</p>
                    <p><strong>Product Carrying Cost:</strong> {p.productCarryingCost?.toString()} $</p>
                  </div>
                ))}

              </div>
            </div>
          ) : (
            <p style={{ marginTop: 20, color: "#555" }}>No products found.</p>
          )}
        </div>
 <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }}>
      <h2 style={{ marginBottom: 20 }}>QR Scanner</h2>

      {/* Camera Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => setCameraActive(true)}
          disabled={cameraActive}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#1976d2",
            color: "#fff",
            cursor: cameraActive ? "not-allowed" : "pointer"
          }}
        >
          Start Camera
        </button>
        <button
          onClick={() => setCameraActive(false)}
          disabled={!cameraActive}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#f44336",
            color: "#fff",
            cursor: !cameraActive ? "not-allowed" : "pointer"
          }}
        >
          Stop Camera
        </button>
      </div>

      {/* Scanner Card */}
      <div
        style={{
          width: "360px",
          borderRadius: "15px",
          overflow: "hidden",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          marginBottom: 20,
          minHeight: 270,
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {cameraActive && (
          <QrReader
            scanDelay={200}
            constraints={{ facingMode: "user" }}
            onResult={handleScan}
            style={{ width: "100%" }}
          />
        )}
        {!cameraActive && <span style={{ color: "#fff" }}>Camera is stopped</span>}
      </div>

      {/* Product Details Card */}
      {product ? (
        <div
          style={{
            width: "360px",
            borderRadius: "15px",
            padding: "20px",
            backgroundColor: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            textAlign: "left",
          }}
        >
          <h3 style={{ marginBottom: 15 }}>Product Details</h3>
          <p><strong>ID:</strong> {product.id}</p>
          <p><strong>Name:</strong> {product.name}</p>
          {/* <p><strong>Price:</strong> ${product.price}</p> */}
          <p><strong>Tax Amount:</strong> ${product.taxAmount}</p>
          <p><strong>Plastic Amount:</strong> {product.plasticAmount} g</p>
          <p><strong>Production Date:</strong> {product.productionDate}</p>
          <p><strong>Expiry Date:</strong> {product.expiryDate}</p>
          <p><strong>Manufacturer:</strong> {product.manufacturer}</p>
          <p><strong>Current Owner:</strong> {product.currentOwner}</p>
          {/* <p><strong>Recycled:</strong> {product.isRecycled ? "✅ Yes" : "❌ No"}</p>
          <p
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontSize: "12px",
              marginTop: "8px"
            }}
          >
            <strong>Signature:</strong> {product.sign}
          </p> */}
        </div>
      ) : (
        <div
          style={{
            width: "360px",
            borderRadius: "15px",
            padding: "20px",
            backgroundColor: "#f9f9f9",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            textAlign: "center",
          }}
        >
          <p><strong>Scan a product QR code</strong></p>
        </div>
      )}
    </div>


      </>
  );
}

else {
  return (
    <div style={{ textAlign: "center", marginTop: "2rem", color: "#666" }}>
      <h3>🔑 Connect your wallet and register to get started</h3>
    </div>
  );
}

};

  // ---------------------------
  // MAIN RENDER
  // ---------------------------
  return (
    <div className="App">
      {/* Navbar (kept same visual & behavior) */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 2rem",
          background: "linear-gradient(90deg,#1a1a1a,#3a3a3a)",
          color: "white"
        }}
      >
        <div style={{ fontWeight: "700", fontSize: "1.5rem" }}>
          ♻️ Recycling Supply Chain
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {wallet && (
            <span style={{ background: "#222", padding: "0.5rem 1rem", borderRadius: "8px", fontFamily: "monospace" }}>
              {shortAddress(wallet)}
            </span>
          )}
          <button
            onClick={wallet ? disconnectWallet : connectWallet}
            style={{
              background: wallet ? "linear-gradient(90deg,#ef4444,#dc2626)" : "linear-gradient(90deg,#22c55e,#16a34a)",
              color: "white",
              padding: "0.6rem 1.4rem",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: "600"
            }}
          >
            {wallet ? "Disconnect" : "Connect Wallet"}
          </button>
        </div>
      </nav>

      {/* Main Panel (redesigned body) */}
      <div style={{ padding: "2rem", minHeight: "85vh", background: "#f0f4f8" }}>
        {!wallet ? (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <p style={{ fontSize: 18 }}>Please connect your wallet first.</p>
            <p style={{ color: "#666" }}>Connect to Ganache or a compatible network and choose your role to access actions.</p>
          </div>
        ) : (
          <>
            {/* <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <div>
                <label style={{ fontWeight: 600, marginRight: 8 }}>Select Role:</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: "6px 8px", borderRadius: 6 }}>
                  <option value="">--Choose Role--</option>
                  <option value="Authority">Authority</option>
                  <option value="Factory">Factory</option>
                  <option value="Supplier">Supplier</option>
                  <option value="Store">Store</option>
                  <option value="Buyer">Buyer</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => setRefreshToggle(!refreshToggle)} style={{ padding: ".4rem .8rem", borderRadius: 8 }}>Refresh</button>
                <button onClick={loadParticipantData} style={{ padding: ".4rem .8rem", borderRadius: 8 }}>Load Participant Data</button>
              </div>
            </div> */}

            <div style={{ marginTop: 20 }}>
              {renderRolePanel()}
            </div>

            {loading && <p style={{ marginTop: 12 }}>⏳ Transaction in progress...</p>}

            {/* {participantData && (
              <div style={{ marginTop: 20, ...cardStyle }}>
                <h3>📊 Participant Data</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 10 }}>
                  <div>
                    <p><strong>Role:</strong> {participantData.role}</p>
                    <p><strong>Verified:</strong> {participantData.verified ? "✅" : "❌"}</p>
                    <p><strong>Stock Count:</strong> {participantData.stockCount}</p>
                  </div>
                  <div>
                    <p><strong>Total Plastic Bought:</strong> {participantData.totalPlasticBought}</p>
                    <p><strong>Total Plastic Returned:</strong> {participantData.totalPlasticReturned}</p>
                    <p><strong>Total Plastic Reused:</strong> {participantData.totalPlasticReused}</p>
                  </div>
                  <div>
                    <p><strong>Rewards Claimed:</strong> {participantData.rewardsClaimedWei} ETH</p>
                    <p><strong>Rewards Pending:</strong> {participantData.rewardsPending} ETH</p>
                  </div>
                </div>
              </div>
            )} */}
          </>
        )}
      </div>

      <footer style={{ textAlign: "center", padding: "1rem", background: "#1a1a1a", color: "white" }}>
        © {new Date().getFullYear()} RecyclingSupplyChain dApp ♻️
      </footer>
    </div>
  );
}

export default App;
