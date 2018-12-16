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
        bool sell,
        uint price,
        uint amount,
        uint64 timestamp
    );

    event NewTrade(
        address indexed baseToken,
        address indexed tradeToken,
        uint64 bidId,
        uint64 askId,
        address bidOwner,
        address askOwner,
        bool side,
        uint amount,
        uint price,
        uint64 timestamp
    );

    event NewCancelOrder(
        address indexed baseToken,
        address indexed tradeToken,
        address indexed owner,
        uint64 id,
        bool sell,
        uint price,
        uint amount,
        uint64 timestamp
    );

    /* --- FIELDS / CONSTANTS --- */

    /* --- START OF V1 VARIABLES --- */

    uint128 constant MAX_ORDER_SIZE = 1000000000000000000000000000; // 1,000,000,000 units in ether

    uint64 constant MIN_ORDER_SIZE = 10000000000000; // 0.00001 units in ether

    uint64 constant PRICE_DENOMINATOR = 1000000000000000000; // 18 decimal places. This assumes all tokens trading in exchange has 18 decimal places

    uint16 constant MAX_ORDERBOOK_FETCH_SIZE = 20;

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
        OrderNode.Node memory order = OrderNode.Node(id, orderOwner, baseToken, tradeToken, price, amount, uint64(block.timestamp));

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
        OrderNode.Node memory order = OrderNode.Node(id, orderOwner, baseToken, tradeToken, price, amount, uint64(block.timestamp));

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
        returns (uint price, bool isSell, uint amount)
    {
        OrderInfo memory orderInfo = orderInfoMap[id];

        OrderNode.Node memory order;
        if (orderInfo.isSell) {
          order = orderbooks[orderInfo.baseToken][orderInfo.tradeToken].asks.getById(id);
        } else {
          order = orderbooks[orderInfo.baseToken][orderInfo.tradeToken].bids.getById(id);
        }
        price = order.price;
        isSell = orderInfo.isSell;
        amount = order.amount;
    }

    function getOrderBookInfo(address baseToken, address tradeToken)
        external
        view
        returns (uint64 bestAsk, uint64 bestBid)
    {
        bestAsk = orderbooks[baseToken][tradeToken].asks.peak().id;
        bestBid = orderbooks[baseToken][tradeToken].bids.peak().id;
    }

    function getOrderbookAsks(address baseToken, address tradeToken)
        external
        view
        returns (uint[MAX_ORDERBOOK_FETCH_SIZE] memory prices, uint[MAX_ORDERBOOK_FETCH_SIZE] memory amounts)
    {
        AskHeap.Tree storage asks = orderbooks[baseToken][tradeToken].asks;

        uint i = 0;
        uint previousPrice = 0;
        while(OrderNode.isValid(asks.peak()) && i < MAX_ORDERBOOK_FETCH_SIZE) {
            OrderNode.Node memory order = asks.pop();
            prices[i] = order.price;
            amounts[i] = amounts[i].add(order.amount);
            previousPrice = order.price;

            if (asks.peak().price != previousPrice) {
                i++;
            }
        }
    }

    function getOrderbookBids(address baseToken, address tradeToken)
        external
        view
        returns (uint[MAX_ORDERBOOK_FETCH_SIZE] memory prices, uint[MAX_ORDERBOOK_FETCH_SIZE] memory amounts)
    {
        BidHeap.Tree storage bids = orderbooks[baseToken][tradeToken].bids;

        uint i = 0;
        uint previousPrice = 0;
        while(OrderNode.isValid(bids.peak()) && i < MAX_ORDERBOOK_FETCH_SIZE) {
            OrderNode.Node memory order = bids.pop();
            prices[i] = order.price;
            amounts[i] = amounts[i].add(order.amount);
            previousPrice = order.price;

            if (bids.peak().price != previousPrice) {
                i++;
            }
        }
    }

    function dumpAsks(address baseToken, address tradeToken)
        external
        view
        returns (uint[], address[], uint[], uint[])
    {
        AskHeap.Tree storage asks = orderbooks[baseToken][tradeToken].asks;
        uint size = asks.size();
        OrderNode.Node[] memory nodes = asks.dump();
        uint[] memory ids = new uint[](size);
        address[] memory owners = new address[](size);
        uint[] memory prices = new uint[](size);
        uint[] memory amounts = new uint[](size);

        for (uint i = 0; i < size; i++) {
            ids[i] = nodes[i+1].id;
            owners[i] = nodes[i+1].owner;
            prices[i] = nodes[i+1].price;
            amounts[i] = nodes[i+1].amount;
        }

        return (ids, owners, prices, amounts);
    }

    function dumpBids(address baseToken, address tradeToken)
        external
        view
        returns (uint[], address[], uint[], uint[])
    {
        BidHeap.Tree storage bids = orderbooks[baseToken][tradeToken].bids;
        uint size = bids.size();
        OrderNode.Node[] memory nodes = bids.dump();
        uint[] memory ids = new uint[](size);
        address[] memory owners = new address[](size);
        uint[] memory prices = new uint[](size);
        uint[] memory amounts = new uint[](size);

        for (uint i = 0; i < size; i++) {
            ids[i] = nodes[i+1].id;
            owners[i] = nodes[i+1].owner;
            prices[i] = nodes[i+1].price;
            amounts[i] = nodes[i+1].amount;
        }

        return (ids, owners, prices, amounts);
    }

    /* --- INTERNAL / PRIVATE METHODS --- */

    function isValidOrder(
        address baseToken,
        address tradeToken,
        uint tradeTokenAmount,
        uint price
    )
        private
        pure
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

            emit NewTrade(order.baseToken, order.tradeToken, matchingOrder.id, order.id, matchingOrder.owner, order.owner, false, tradeAmount, matchingOrder.price, uint64(block.timestamp));

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

            emit NewTrade(order.baseToken, order.tradeToken, order.id, matchingOrder.id, order.owner, matchingOrder.owner, true, tradeAmount, matchingOrder.price, uint64(block.timestamp));

            if (matchingOrder.amount != 0) {
                asks.updateAmountById(matchingOrder.id, matchingOrder.amount);
                break;
            }

            asks.pop();
            delete orderInfoMap[matchingOrder.id];
        }
    }
}
