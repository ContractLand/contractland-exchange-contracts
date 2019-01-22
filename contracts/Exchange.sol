pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "zos-lib/contracts/migrations/Initializable.sol";

import "./interfaces/ERC20.sol";

import "./libraries/OrderNode.sol";
import "./libraries/AskHeap.sol";
import "./libraries/BidHeap.sol";

import "./DestructibleTransfer.sol";

contract Exchange is Initializable, Pausable {
    using SafeMath for uint;
    using AskHeap for AskHeap.Tree;
    using BidHeap for BidHeap.Tree;

    /* --- STRUCTS --- */

    struct OrderBook {
        AskHeap.Tree asks;
        BidHeap.Tree bids;
    }

    struct OrderInfo {
        address owner;
        address baseToken;
        address tradeToken;
        bool isSell;
    }

    /* --- EVENTS --- */

    event NewOrder(
        address indexed baseToken,
        address indexed tradeToken,
        address indexed owner,
        uint64 id,
        bool isSell,
        uint price,
        uint amount,
        uint64 timestamp
    );

    event NewTrade(
        bytes32 indexed tokenPairHash,
        address indexed taker,
        address indexed maker,
        uint64 takeOrderId,
        uint64 makeOrderId,
        bool isSell,
        uint amount,
        uint price,
        uint64 timestamp
    );

    event NewCancelOrder(
        address indexed baseToken,
        address indexed tradeToken,
        address indexed owner,
        uint64 id,
        bool isSell,
        uint price,
        uint amount,
        uint64 timestamp
    );

    /* --- FIELDS / CONSTANTS --- */

    /* --- START OF V1 VARIABLES --- */

    uint128 public MAX_ORDER_SIZE;

    uint64 public MIN_ORDER_SIZE;

    uint64 constant PRICE_DENOMINATOR = 1000000000000000000; // 18 decimal places. This assumes all tokens trading in exchange has 18 decimal places

    uint64 lastOrderId;

    // Mapping of order id to order meta data that helps to identify the order in the book
    mapping(uint64 => OrderInfo) orderInfoMap;

    // Mapping of base token to trade token to OrderBook
    mapping(address => mapping(address => OrderBook)) orderbooks;

    // Mapping of user address to mapping of token address to reserved balance in orderbook
    mapping (address => mapping (address => uint)) public reserved;

    /* --- END OF V1 VARIABLES --- */

    /* --- CONSTRUCTOR / INITIALIZATION --- */

    function initialize()
        public
        isInitializer
    {
        MAX_ORDER_SIZE = 1000000000 ether;
        MIN_ORDER_SIZE = 0.00001 ether;

        owner = msg.sender; // initialize owner for admin functionalities
    }

    /* --- EXTERNAL / PUBLIC  METHODS --- */

    function sell(
        address baseToken,
        address tradeToken,
        address orderOwner,
        uint amount,
        uint price
    )
        external
        whenNotPaused
        payable
        returns (uint64)
    {
        require(isValidOrder(baseToken, tradeToken, amount, price));

        transferFundFromUser(orderOwner, tradeToken, amount);

        uint64 id = ++lastOrderId;
        OrderNode.Node memory order = OrderNode.Node(id, orderOwner, baseToken, tradeToken, price, amount, amount, true, uint64(block.timestamp));

        emit NewOrder(baseToken, tradeToken, orderOwner, id, true, price, amount, order.timestamp);

        matchSell(order);

        if (order.amount != 0) {
            orderbooks[baseToken][tradeToken].asks.add(order);
            orderInfoMap[id] = OrderInfo(orderOwner, baseToken, tradeToken, true);
        }

        return id;
    }

    function buy(
        address baseToken,
        address tradeToken,
        address orderOwner,
        uint amount,
        uint price
    )
        external
        whenNotPaused
        payable
        returns (uint64)
    {
        require(isValidOrder(baseToken, tradeToken, amount, price));

        uint baseTokenAmount = amount.mul(price).div(PRICE_DENOMINATOR);
        transferFundFromUser(orderOwner, baseToken, baseTokenAmount);

        uint64 id = ++lastOrderId;
        OrderNode.Node memory order = OrderNode.Node(id, orderOwner, baseToken, tradeToken, price, amount, amount, false, uint64(block.timestamp));

        emit NewOrder(baseToken, tradeToken, orderOwner, id, false, price, amount, order.timestamp);

        matchBuy(order);

        if (order.amount != 0) {
            orderbooks[baseToken][tradeToken].bids.add(order);
            orderInfoMap[id] = OrderInfo(orderOwner, baseToken, tradeToken, false);
        }

        return id;
    }

    function cancelOrder(uint64 id)
        external
    {
        OrderInfo memory orderInfo = orderInfoMap[id];
        require(orderInfo.owner == msg.sender || msg.sender == owner);

        OrderNode.Node memory orderToCancel;
        if (orderInfo.isSell) {
            orderToCancel = orderbooks[orderInfo.baseToken][orderInfo.tradeToken].asks.getById(id);
            reserved[orderToCancel.tradeToken][orderToCancel.owner] = reserved[orderToCancel.tradeToken][orderToCancel.owner].sub(orderToCancel.amount);
            transferFundToUser(orderToCancel.owner, orderToCancel.tradeToken, orderToCancel.amount);
            orderbooks[orderToCancel.baseToken][orderToCancel.tradeToken].asks.removeById(id);
        } else {
            orderToCancel = orderbooks[orderInfo.baseToken][orderInfo.tradeToken].bids.getById(id);
            reserved[orderToCancel.baseToken][orderToCancel.owner] = reserved[orderToCancel.baseToken][orderToCancel.owner].sub(orderToCancel.amount.mul(orderToCancel.price).div(PRICE_DENOMINATOR));
            transferFundToUser(orderToCancel.owner, orderToCancel.baseToken, orderToCancel.amount.mul(orderToCancel.price).div(PRICE_DENOMINATOR));
            orderbooks[orderToCancel.baseToken][orderToCancel.tradeToken].bids.removeById(id);
        }

        emit NewCancelOrder(orderInfo.baseToken, orderInfo.tradeToken, orderInfo.owner, id, orderInfo.isSell, orderToCancel.price, orderToCancel.amount, uint64(block.timestamp));
        delete orderInfoMap[id];
    }

    function getOrder(uint64 id)
        external
        view
        returns (
            address owner,
            address baseToken,
            address tradeToken,
            uint price,
            uint originalAmount,
            uint amount,
            bool isSell,
            uint64 timestamp
        )
    {
        OrderInfo memory orderInfo = orderInfoMap[id];
        OrderNode.Node memory order;
        if (orderInfo.isSell) {
          order = orderbooks[orderInfo.baseToken][orderInfo.tradeToken].asks.getById(id);
        } else {
          order = orderbooks[orderInfo.baseToken][orderInfo.tradeToken].bids.getById(id);
        }

        owner = order.owner;
        baseToken = order.baseToken;
        tradeToken = order.tradeToken;
        price = order.price;
        originalAmount = order.originalAmount;
        amount = order.amount;
        isSell = order.isSell;
        timestamp = order.timestamp;
    }

    function getOrderBookInfo(address baseToken, address tradeToken)
        external
        view
        returns (uint64 bestAsk, uint64 bestBid)
    {
        bestAsk = orderbooks[baseToken][tradeToken].asks.peak().id;
        bestBid = orderbooks[baseToken][tradeToken].bids.peak().id;
    }

    function getAsks(address baseToken, address tradeToken)
        external
        view
        returns (uint64[], address[], uint[], uint[], uint[], uint64[])
    {
        return orderbooks[baseToken][tradeToken].asks.getOrders();
    }

    function getBids(address baseToken, address tradeToken)
        external
        view
        returns (uint64[], address[], uint[], uint[], uint[], uint64[])
    {
        return orderbooks[baseToken][tradeToken].bids.getOrders();
    }

    function setMaxOrderSize(uint128 newMax)
        external
        onlyOwner
    {
        MAX_ORDER_SIZE = newMax;
    }

    function setMinOrderSize(uint64 newMin)
        external
        onlyOwner
    {
        MIN_ORDER_SIZE = newMin;
    }

    /* --- INTERNAL / PRIVATE METHODS --- */

    function isValidOrder(
        address baseToken,
        address tradeToken,
        uint tradeTokenAmount,
        uint price
    )
        private
        view
        returns (bool)
    {
        return tradeTokenAmount != 0 &&
               tradeTokenAmount <= MAX_ORDER_SIZE &&
               tradeTokenAmount >= MIN_ORDER_SIZE &&
               price != 0 &&
               baseToken != tradeToken &&
               tradeTokenAmount.mul(price).div(PRICE_DENOMINATOR) != 0 &&
               tradeTokenAmount.mul(price).div(PRICE_DENOMINATOR) <= MAX_ORDER_SIZE &&
               tradeTokenAmount.mul(price).div(PRICE_DENOMINATOR) >= MIN_ORDER_SIZE;
    }

    function transferFundFromUser(address sender, address token, uint amount)
        private
    {
        if(token == address(0)) {
            require(msg.value == amount);
        } else {
            ERC20(token).transferFrom(sender, this, amount);
        }
        reserved[token][sender] = reserved[token][sender].add(amount);
    }

    function transferFundToUser(address recipient, address token, uint amount)
        private
    {
        if(token == address(0)) {
            if (!recipient.send(amount)) {
                (new DestructibleTransfer).value(amount)(recipient);
            }
        } else {
            ERC20(token).transfer(recipient, amount);
        }
    }

    function matchSell(OrderNode.Node memory order)
        private
    {
        BidHeap.Tree storage bids = orderbooks[order.baseToken][order.tradeToken].bids;

        while (order.amount != 0 &&
               OrderNode.isValid(bids.peak()) &&
               order.price <= bids.peak().price) {
            OrderNode.Node memory matchingOrder = bids.peak();
            uint tradeAmount;

            if (matchingOrder.amount >= order.amount) {
                tradeAmount = order.amount;
                matchingOrder.amount = matchingOrder.amount.sub(order.amount);
                order.amount = 0;
            } else {
                tradeAmount = matchingOrder.amount;
                order.amount = order.amount.sub(matchingOrder.amount);
                matchingOrder.amount = 0;
            }

            reserved[order.tradeToken][order.owner] = reserved[order.tradeToken][order.owner].sub(tradeAmount);
            transferFundToUser(matchingOrder.owner, order.tradeToken, tradeAmount);
            uint baseTokenAmount = tradeAmount.mul(matchingOrder.price).div(PRICE_DENOMINATOR);
            transferFundToUser(order.owner, order.baseToken, baseTokenAmount);
            reserved[order.baseToken][matchingOrder.owner] = reserved[order.baseToken][matchingOrder.owner].sub(baseTokenAmount);

            bytes32 tokenPairHash = keccak256(abi.encodePacked(order.baseToken, order.tradeToken));
            emit NewTrade(tokenPairHash, order.owner, matchingOrder.owner, order.id, matchingOrder.id, true, tradeAmount, matchingOrder.price, uint64(block.timestamp));

            if (matchingOrder.amount != 0) {
                bids.updateAmountById(matchingOrder.id, matchingOrder.amount);
                break;
            }

            bids.pop();
            delete orderInfoMap[matchingOrder.id];
        }
    }

    function matchBuy(OrderNode.Node memory order)
        private
    {
        AskHeap.Tree storage asks = orderbooks[order.baseToken][order.tradeToken].asks;

        while (order.amount != 0 &&
               OrderNode.isValid(asks.peak()) &&
               order.price >= asks.peak().price) {
            OrderNode.Node memory matchingOrder = asks.peak();
            uint tradeAmount;

            if (matchingOrder.amount >= order.amount) {
                tradeAmount = order.amount;
                matchingOrder.amount = matchingOrder.amount.sub(order.amount);
                order.amount = 0;
            } else {
                tradeAmount = matchingOrder.amount;
                order.amount = order.amount.sub(matchingOrder.amount);
                matchingOrder.amount = 0;
            }

            reserved[order.baseToken][order.owner] = reserved[order.baseToken][order.owner].sub(tradeAmount.mul(order.price).div(PRICE_DENOMINATOR));
            transferFundToUser(order.owner, order.baseToken, tradeAmount.mul(order.price.sub(matchingOrder.price)).div(PRICE_DENOMINATOR));
            reserved[order.tradeToken][matchingOrder.owner] = reserved[order.tradeToken][matchingOrder.owner].sub(tradeAmount);
            transferFundToUser(matchingOrder.owner, order.baseToken, tradeAmount.mul(matchingOrder.price).div(PRICE_DENOMINATOR));
            transferFundToUser(order.owner, order.tradeToken, tradeAmount);

            bytes32 tokenPairHash = keccak256(abi.encodePacked(order.baseToken, order.tradeToken));
            emit NewTrade(tokenPairHash, order.owner, matchingOrder.owner, order.id, matchingOrder.id, false, tradeAmount, matchingOrder.price, uint64(block.timestamp));

            if (matchingOrder.amount != 0) {
                asks.updateAmountById(matchingOrder.id, matchingOrder.amount);
                break;
            }

            asks.pop();
            delete orderInfoMap[matchingOrder.id];
        }
    }
}
