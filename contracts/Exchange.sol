pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "zos-lib/contracts/migrations/Initializable.sol";

import "./interfaces/ERC20.sol";

import "./libraries/OrderNode.sol";
import "./libraries/AskHeap.sol";
import "./libraries/BidHeap.sol";
import "./libraries/TradeHistory.sol";
import "./libraries/OrderHistory.sol";
import "./libraries/OpenOrder.sol";

import "./DestructibleTransfer.sol";

contract Exchange is Initializable, Pausable {
    using SafeMath for uint;
    using AskHeap for AskHeap.Tree;
    using BidHeap for BidHeap.Tree;
    using TradeHistory for TradeHistory.Trades;
    using OrderHistory for OrderHistory.Orders;
    using OpenOrder for OpenOrder.Orders;

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

    uint64 public MIN_PRICE_SIZE;

    uint64 public MIN_AMOUNT_SIZE;

    uint128 public MAX_TOTAL_SIZE;

    uint16 public MAX_GET_RETURN_SIZE;

    uint64 constant PRICE_DENOMINATOR = 1000000000000000000; // 18 decimal places. This assumes all tokens trading in exchange has 18 decimal places

    uint64 lastOrderId;

    // Mapping of order id to order meta data that helps to identify the order in the book
    mapping(uint64 => OrderInfo) orderInfoMap;

    // Mapping of base token to trade token to OrderBook
    mapping(address => mapping(address => OrderBook)) orderbooks;

    // Mapping of user address to mapping of token address to reserved balance in orderbook
    mapping(address => mapping (address => uint)) public reserved;

    // Mapping of base token to trade token to user address to open orders
    mapping(address => mapping(address => mapping(address => OpenOrder.Orders))) userOrders;

    // Mapping of base token to trade token to user address to order history
    mapping(address => mapping(address => mapping(address => OrderHistory.Orders))) userOrderHistory;

    // Mapping of base token to trade token to trade history
    mapping(address => mapping(address => TradeHistory.Trades)) tradeHistory;

    // Mapping of base token to trade token to user address to trade history
    mapping(address => mapping(address => mapping(address => TradeHistory.Trades))) userTradeHistory;

    /* --- END OF V1 VARIABLES --- */

    /* --- CONSTRUCTOR / INITIALIZATION --- */

    function initialize()
        public
        isInitializer
    {
        MIN_PRICE_SIZE = 0.00000001 ether;
        MIN_AMOUNT_SIZE = 0.0001 ether;
        MAX_TOTAL_SIZE = 1000000000 ether;
        MAX_GET_RETURN_SIZE = 1000;

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

        // Record new sell order creation
        emit NewOrder(baseToken, tradeToken, orderOwner, id, true, price, amount, order.timestamp);

        matchSell(order);

        if (order.amount != 0) {
            // Add remaining order to orderbook and open orders
            orderbooks[baseToken][tradeToken].asks.add(order);
            orderInfoMap[id] = OrderInfo(orderOwner, baseToken, tradeToken, true);
            userOrders[baseToken][tradeToken][orderOwner].add(OpenOrder.Order(id, price, amount, order.amount, order.isSell, order.timestamp));
        } else {
            // Add filled order to order history
            userOrderHistory[baseToken][tradeToken][orderOwner].add(OrderHistory.Order(id, price, amount, 0, order.isSell, 0), order.timestamp);
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

        // Record new sell order creation
        emit NewOrder(baseToken, tradeToken, orderOwner, id, false, price, amount, order.timestamp);

        matchBuy(order);

        if (order.amount != 0) {
            // Add remaining maker order to orderbook and open orders
            orderbooks[baseToken][tradeToken].bids.add(order);
            orderInfoMap[id] = OrderInfo(orderOwner, baseToken, tradeToken, false);
            userOrders[baseToken][tradeToken][orderOwner].add(OpenOrder.Order(id, price, amount, order.amount, order.isSell, order.timestamp));
        } else {
          // Add filled order to order history
          userOrderHistory[baseToken][tradeToken][orderOwner].add(OrderHistory.Order(id, price, amount, 0, order.isSell, 0), order.timestamp);
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
        // Remove from user open orders
        userOrders[orderToCancel.baseToken][orderToCancel.tradeToken][orderToCancel.owner].remove(orderToCancel.id);
        // Add cancelled order to user order history
        userOrderHistory[orderToCancel.baseToken][orderToCancel.tradeToken][orderToCancel.owner].add(
          OrderHistory.Order(
            orderToCancel.id,
            orderToCancel.price,
            orderToCancel.originalAmount,
            orderToCancel.amount,
            orderToCancel.isSell,
            uint64(block.timestamp)
          ),
          orderToCancel.timestamp
        );
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

    function getAsks(
      uint16 limit,
      address tradeToken,
      address baseToken
    )
        external
        view
        returns (uint64[], address[], uint[], uint[], uint[], uint64[])
    {
        return orderbooks[baseToken][tradeToken].asks.getOrders(getLimit(limit));
    }

    function getAggregatedAsks(
      uint16 limit,
      address tradeToken,
      address baseToken
    )
        external
        view
        returns (uint[], uint[])
    {
        return orderbooks[baseToken][tradeToken].asks.getAggregatedOrders(getLimit(limit));
    }

    function getBids(
      uint16 limit,
      address tradeToken,
      address baseToken
    )
        external
        view
        returns (uint64[], address[], uint[], uint[], uint[], uint64[])
    {
        return orderbooks[baseToken][tradeToken].bids.getOrders(getLimit(limit));
    }

    function getAggregatedBids(
      uint16 limit,
      address tradeToken,
      address baseToken
    )
        external
        view
        returns (uint[], uint[])
    {
        return orderbooks[baseToken][tradeToken].bids.getAggregatedOrders(getLimit(limit));
    }

    function getTradeHistory(
        uint16 limit,
        uint64[] timeRange,
        address tradeToken,
        address baseToken
    )
        external
        view
        returns (uint64[], uint[], uint[], bool[], uint64[])
    {
        return tradeHistory[baseToken][tradeToken].getTrades(timeRange, getLimit(limit));
    }

    function getUserTradeHistory(
        uint16 limit,
        uint64[] timeRange,
        address user,
        address tradeToken,
        address baseToken
    )
        external
        view
        returns (uint64[], uint[], uint[], bool[], uint64[])
    {
        return userTradeHistory[baseToken][tradeToken][user].getTrades(timeRange, getLimit(limit));
    }

    function getUserOpenOrders(
        address user,
        address tradeToken,
        address baseToken
    )
        external
        view
        returns (uint64[], uint[], uint[], uint[], bool[], uint64[])
    {
        return userOrders[baseToken][tradeToken][user].getOrders(MAX_GET_RETURN_SIZE);
    }

    function getUserOrderHistory(
        uint16 limit,
        uint64[] timeRange,
        address user,
        address tradeToken,
        address baseToken
    )
        external
        view
        returns (uint64[], uint[], uint[], uint[], bool[], uint64[], uint64[])
    {
        return userOrderHistory[baseToken][tradeToken][user].getOrders(timeRange, getLimit(limit));
    }

    function setMinPriceSize(uint64 newMin)
        external
        onlyOwner
    {
        MIN_PRICE_SIZE = newMin;
    }

    function setMinAmountSize(uint64 newMin)
        external
        onlyOwner
    {
        MIN_AMOUNT_SIZE = newMin;
    }

    function setMaxTotalSize(uint128 newMax)
        external
        onlyOwner
    {
        MAX_TOTAL_SIZE = newMax;
    }

    function setMaxGetSize(uint16 newMax)
        external
        onlyOwner
    {
        MAX_GET_RETURN_SIZE = newMax;
    }

    /* --- INTERNAL / PRIVATE METHODS --- */

    function getLimit(uint16 limit)
        private
        view
        returns (uint16)
    {
        return limit < MAX_GET_RETURN_SIZE ? limit : MAX_GET_RETURN_SIZE;
    }

    function isValidOrder(
        address baseToken,
        address tradeToken,
        uint amount,
        uint price
    )
        private
        view
        returns (bool)
    {
        return baseToken != tradeToken &&
               price >= MIN_PRICE_SIZE &&
               amount >= MIN_AMOUNT_SIZE &&
               amount.mul(price).div(PRICE_DENOMINATOR) <= MAX_TOTAL_SIZE;
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

            // Substract tradeToken from taker reserve
            reserved[order.tradeToken][order.owner] = reserved[order.tradeToken][order.owner].sub(tradeAmount);
            // Transfer tradeToken to maker
            transferFundToUser(matchingOrder.owner, order.tradeToken, tradeAmount);
            // Transfer baseToken to taker (maker order price is used)
            uint baseTokenAmount = tradeAmount.mul(matchingOrder.price).div(PRICE_DENOMINATOR);
            transferFundToUser(order.owner, order.baseToken, baseTokenAmount);
            // Substract baseToken from maker reserve
            reserved[order.baseToken][matchingOrder.owner] = reserved[order.baseToken][matchingOrder.owner].sub(baseTokenAmount);

            // Log new trade
            bytes32 tokenPairHash = keccak256(abi.encodePacked(order.baseToken, order.tradeToken));
            emit NewTrade(tokenPairHash,
              order.owner,
              matchingOrder.owner,
              order.id,
              matchingOrder.id,
              true,
              tradeAmount,
              matchingOrder.price,
              uint64(block.timestamp)
            );
            // Add to trade history
            tradeHistory[order.baseToken][order.tradeToken].add(
              TradeHistory.Trade(
                order.id,
                matchingOrder.price,
                tradeAmount,
                true
              ),
              uint64(block.timestamp)
            );
            // Add to taker trade history
            userTradeHistory[order.baseToken][order.tradeToken][order.owner].add(
              TradeHistory.Trade(
                order.id,
                matchingOrder.price,
                tradeAmount,
                true
              ),
              uint64(block.timestamp)
            );
            // Add to maker trade history
            userTradeHistory[matchingOrder.baseToken][matchingOrder.tradeToken][matchingOrder.owner].add(
              TradeHistory.Trade(
                matchingOrder.id,
                matchingOrder.price,
                tradeAmount,
                true
              ),
              uint64(block.timestamp)
            );

            // Upate amount for remaining order in orderbook and user open orders
            if (matchingOrder.amount != 0) {
                bids.updateAmountById(matchingOrder.id, matchingOrder.amount);
                userOrders[matchingOrder.baseToken][matchingOrder.tradeToken][matchingOrder.owner].update(matchingOrder.id, matchingOrder.amount);
                break;
            }

            // Remove filled order from orderbook
            bids.pop();
            // Remove filled order from user open orders
            userOrders[matchingOrder.baseToken][matchingOrder.tradeToken][matchingOrder.owner].remove(matchingOrder.id);
            // Delete record from orderInfoMap
            delete orderInfoMap[matchingOrder.id];
            // Add filled order to maker order history
            userOrderHistory[matchingOrder.baseToken][matchingOrder.tradeToken][matchingOrder.owner].add(
              OrderHistory.Order(
                matchingOrder.id,
                matchingOrder.price,
                matchingOrder.originalAmount,
                0,
                matchingOrder.isSell,
                0
              ),
              matchingOrder.timestamp
            );
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

            // Substract baseToken from taker reserve
            reserved[order.baseToken][order.owner] = reserved[order.baseToken][order.owner].sub(tradeAmount.mul(order.price).div(PRICE_DENOMINATOR));
            // Transfer the difference between taker and maker price to taker
            transferFundToUser(order.owner, order.baseToken, tradeAmount.mul(order.price.sub(matchingOrder.price)).div(PRICE_DENOMINATOR));
            // Substract tradeToken from maker reserve
            reserved[order.tradeToken][matchingOrder.owner] = reserved[order.tradeToken][matchingOrder.owner].sub(tradeAmount);
            // Transfer baseToken to maker (based on maker price)
            transferFundToUser(matchingOrder.owner, order.baseToken, tradeAmount.mul(matchingOrder.price).div(PRICE_DENOMINATOR));
            // Transfer tradeToken to taker
            transferFundToUser(order.owner, order.tradeToken, tradeAmount);

            // Log new trade
            bytes32 tokenPairHash = keccak256(abi.encodePacked(order.baseToken, order.tradeToken));
            emit NewTrade(
              tokenPairHash,
              order.owner,
              matchingOrder.owner,
              order.id,
              matchingOrder.id,
              false,
              tradeAmount,
              matchingOrder.price,
              uint64(block.timestamp)
            );
            // Add to trade history
            tradeHistory[order.baseToken][order.tradeToken].add(
              TradeHistory.Trade(
                order.id,
                matchingOrder.price,
                tradeAmount,
                false
              ),
              uint64(block.timestamp)
            );
            // Add to taker trade history
            userTradeHistory[order.baseToken][order.tradeToken][order.owner].add(
              TradeHistory.Trade(
                order.id,
                matchingOrder.price,
                tradeAmount,
                false
              ),
              uint64(block.timestamp)
            );
            // Add to maker trade history
            userTradeHistory[matchingOrder.baseToken][matchingOrder.tradeToken][matchingOrder.owner].add(
              TradeHistory.Trade(matchingOrder.id,
                matchingOrder.price,
                tradeAmount,
                false
              ),
              uint64(block.timestamp)
            );

            // Upate amount for remaining order in orderbook and user open orders
            if (matchingOrder.amount != 0) {
                asks.updateAmountById(matchingOrder.id, matchingOrder.amount);
                userOrders[matchingOrder.baseToken][matchingOrder.tradeToken][matchingOrder.owner].update(matchingOrder.id, matchingOrder.amount);
                break;
            }

            // Remove filled order from orderbook
            asks.pop();
            // Remove filled order from user open orders
            userOrders[matchingOrder.baseToken][matchingOrder.tradeToken][matchingOrder.owner].remove(matchingOrder.id);
            // Delete record from orderInfoMap
            delete orderInfoMap[matchingOrder.id];
            // Add filled order to maker order history
            userOrderHistory[matchingOrder.baseToken][matchingOrder.tradeToken][matchingOrder.owner].add(
              OrderHistory.Order(matchingOrder.id,
                matchingOrder.price,
                matchingOrder.originalAmount,
                0,
                matchingOrder.isSell,
                0
              ),
              matchingOrder.timestamp
            );
        }
    }
}
