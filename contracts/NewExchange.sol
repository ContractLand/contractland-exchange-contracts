pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "zos-lib/contracts/migrations/Initializable.sol";
import "./libraries/OrderBookHeap.sol";
import "./libraries/AskHeap.sol";
import "./libraries/BidHeap.sol";
import "./interfaces/ERC20.sol";
import "./DestructibleTransfer.sol";

contract NewExchange is Initializable, Pausable {
    using SafeMath for uint;
    using AskHeap for AskHeap.Asks;
    using BidHeap for BidHeap.Bids;

    /* --- STRUCTS --- */

    struct Pair {
        AskHeap.Asks asks;
        BidHeap.Bids bids;
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
        bool side,
        uint amount,
        uint price,
        uint64 timestamp
    );

    event NewCancelOrder(uint64 id);

    /* --- FIELDS / CONSTANTS --- */

    // ***Start of V1.0.0 storage variables***

    uint16 constant ORDERBOOK_MAX_ITEMS = 20;

    uint128 constant MAX_ORDER_SIZE = 1000000000000000000000000000; // 1,000,000,000 units in ether

    uint64 constant MIN_ORDER_SIZE = 10000000000000; // 0.00001 units in ether

    uint64 lastOrderId;

    mapping(uint64 => OrderBookHeap.Node) orders;

    // Mapping of base token to trade token to Pair
    mapping(address => mapping(address => Pair)) pairs;

    // Mapping of user address to mapping of token address to reserved balance in orderbook
    mapping (address => mapping (address => uint)) public reserved;

    uint64 private priceDenominator; // should be 18 decimal places

    // ***End of V1.0.0 storage variables***

    /* --- CONSTRUCTOR / INITIALIZATION --- */

    function initialize() public isInitializer {
        owner = msg.sender; // initialize owner for admin functionalities
        priceDenominator = 1000000000000000000; // This assumes all tokens trading in exchange has 18 decimal places
    }

    /* --- EXTERNAL / PUBLIC  METHODS --- */

    function sell(address baseToken, address tradeToken, address orderOwner, uint amount, uint price) public whenNotPaused payable returns (uint64) {
        require(isValidOrder(baseToken, tradeToken, amount, price));

        transferFundFromUser(orderOwner, tradeToken, amount);

        uint64 id = ++lastOrderId;
        OrderBookHeap.Node memory order = OrderBookHeap.Node(id, orderOwner, baseToken, tradeToken, price, amount, uint64(block.timestamp));

        emit NewOrder(baseToken, tradeToken, orderOwner, id, true, price, amount, order.timestamp);

        matchSell(order);

        if (order.amount != 0) {
            pairs[baseToken][tradeToken].asks.insert(order);
            orders[id] = order;
        }

        return id;
    }

    function buy(address baseToken, address tradeToken, address orderOwner, uint amount, uint price) public whenNotPaused payable returns (uint64) {
        require(isValidOrder(baseToken, tradeToken, amount, price));

        uint baseTokenAmount = amount.mul(price).div(priceDenominator);
        transferFundFromUser(orderOwner, baseToken, baseTokenAmount);

        uint64 id = ++lastOrderId;
        OrderBookHeap.Node memory order = OrderBookHeap.Node(id, orderOwner, baseToken, tradeToken, price, amount, uint64(block.timestamp));

        emit NewOrder(baseToken, tradeToken, orderOwner, id, false, price, amount, order.timestamp);

        matchBuy(order);

        if (order.amount != 0) {
            pairs[baseToken][tradeToken].bids.insert(order);
            orders[id] = order;
        }

        return id;
    }

    function cancelOrder(uint64 id) public {
        OrderBookHeap.Node memory order = orders[id];
        require(order.owner == msg.sender || msg.sender == owner);

        if (OrderBookHeap.isNode(pairs[order.baseToken][order.tradeToken].asks.getById(id))) {
            reserved[order.tradeToken][order.owner] = reserved[order.tradeToken][order.owner].sub(order.amount);
            transferFundToUser(order.owner, order.tradeToken, order.amount);
            pairs[order.baseToken][order.tradeToken].asks.extractById(id);
        } else {
            reserved[order.baseToken][order.owner] = reserved[order.baseToken][order.owner].sub(order.amount.mul(order.price).div(priceDenominator));
            transferFundToUser(order.owner, order.baseToken, order.amount.mul(order.price).div(priceDenominator));
            pairs[order.baseToken][order.tradeToken].bids.extractById(id);
        }

        delete orders[id];

        emit NewCancelOrder(id);
    }

    function getOrder(uint64 id) public view returns (uint price, bool isSell, uint amount) {
        OrderBookHeap.Node memory order = orders[id];
        price = order.price;
        /* isSell = order.sell; */
        amount = order.amount;
    }

    function getOrderBookInfo(address baseToken, address tradeToken) public view returns (uint64 bestAsk, uint64 bestBid) {
        bestAsk = pairs[baseToken][tradeToken].asks.getMin().id;
        bestBid = pairs[baseToken][tradeToken].bids.getMax().id;
    }

    /* function getOrderbookBids(address baseToken, address tradeToken)
        external
        view
        returns (uint[ORDERBOOK_MAX_ITEMS] price, bool[ORDERBOOK_MAX_ITEMS] isSell, uint[ORDERBOOK_MAX_ITEMS] amount, uint[ORDERBOOK_MAX_ITEMS] id, uint64 items)
    {
        Pair memory pair = pairs[baseToken][tradeToken];
        uint64 currentId = pair.bestBid;
        items = 0;
        uint previousPrice = 0;
        while(currentId != 0 && items < ORDERBOOK_MAX_ITEMS) {
            Order memory order = orders[currentId];
            price[items] = order.price;
            isSell[items] = order.sell;
            amount[items] = amount[items] + order.amount;
            id[items] = currentId;
            previousPrice = order.price;

            currentId = pairs[baseToken][tradeToken].orderbook[currentId].prev;
            if (orders[currentId].price != previousPrice) {
                items = items + 1;
            }
        }
    }

    function getOrderbookAsks(address baseToken, address tradeToken)
        external
        view
        returns (uint[ORDERBOOK_MAX_ITEMS] price, bool[ORDERBOOK_MAX_ITEMS] isSell, uint[ORDERBOOK_MAX_ITEMS] amount, uint[ORDERBOOK_MAX_ITEMS] id, uint64 items)
    {
        Pair memory pair = pairs[baseToken][tradeToken];
        uint64 currentId = pair.bestAsk;
        items = 0;
        uint previousPrice = 0;
        while(currentId != 0 && items < ORDERBOOK_MAX_ITEMS) {
            Order memory order = orders[currentId];
            price[items] = order.price;
            isSell[items] = order.sell;
            amount[items] = amount[items] + order.amount;
            id[items] = currentId;
            previousPrice = order.price;

            currentId = pairs[baseToken][tradeToken].orderbook[currentId].next;
            if (orders[currentId].price != previousPrice) {
                items = items + 1;
            }
        }
    } */

    /* --- INTERNAL / PRIVATE METHODS --- */

    function isValidOrder(address baseToken, address tradeToken, uint tradeTokenAmount, uint price) private returns (bool) {
        return tradeTokenAmount != 0 &&
               tradeTokenAmount <= MAX_ORDER_SIZE &&
               tradeTokenAmount >= MIN_ORDER_SIZE &&
               price != 0 &&
               baseToken != tradeToken &&
               tradeTokenAmount.mul(price).div(priceDenominator) != 0 &&
               tradeTokenAmount.mul(price).div(priceDenominator) <= MAX_ORDER_SIZE &&
               tradeTokenAmount.mul(price).div(priceDenominator) >= MIN_ORDER_SIZE;
    }

    function transferFundFromUser(address sender, address token, uint amount) private {
        if(token == address(0)) {
            require(msg.value == amount);
        } else {
            ERC20(token).transferFrom(sender, this, amount);
        }
        reserved[token][sender] = reserved[token][sender].add(amount);
    }

    function transferFundToUser(address recipient, address token, uint amount) private {
        if(token == address(0)) {
            if (!recipient.send(amount)) {
                (new DestructibleTransfer).value(amount)(recipient);
            }
        } else {
            ERC20(token).transfer(recipient, amount);
        }
    }

    function matchSell(OrderBookHeap.Node memory order) private {
        BidHeap.Bids storage bids = pairs[order.baseToken][order.tradeToken].bids;

        while (OrderBookHeap.isNode(bids.getMax()) && order.price <= bids.getMax().price) {

            OrderBookHeap.Node memory matchingOrder = bids.getMax();
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
            transferFundToUser( matchingOrder.owner, order.tradeToken,tradeAmount);
            uint baseTokenAmount = tradeAmount.mul(matchingOrder.price).div(priceDenominator);
            transferFundToUser(order.owner, order.baseToken, baseTokenAmount);
            reserved[order.baseToken][matchingOrder.owner] = reserved[order.baseToken][matchingOrder.owner].sub(baseTokenAmount);

            emit NewTrade(order.baseToken, order.tradeToken, matchingOrder.id, order.id, false, tradeAmount, matchingOrder.price, uint64(block.timestamp));

            if (matchingOrder.amount != 0) {
                bids.update(matchingOrder);
                break;
            }

            bids.extractMax();
        }
    }

    function matchBuy(OrderBookHeap.Node memory order) private {
        AskHeap.Asks storage asks = pairs[order.baseToken][order.tradeToken].asks;

        while (OrderBookHeap.isNode(asks.getMin()) && order.price >= asks.getMin().price) {

            OrderBookHeap.Node memory matchingOrder = asks.getMin();
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

            reserved[order.baseToken][order.owner] = reserved[order.baseToken][order.owner].sub(tradeAmount.mul(order.price).div(priceDenominator));
            transferFundToUser(order.owner, order.baseToken, tradeAmount.mul(order.price.sub(matchingOrder.price)).div(priceDenominator));
            reserved[order.tradeToken][matchingOrder.owner] = reserved[order.tradeToken][matchingOrder.owner].sub(tradeAmount);
            transferFundToUser(matchingOrder.owner, order.baseToken, tradeAmount.mul(matchingOrder.price).div(priceDenominator));
            transferFundToUser(order.owner, order.tradeToken, tradeAmount);

            emit NewTrade(order.baseToken, order.tradeToken, order.id, matchingOrder.id, true, tradeAmount, matchingOrder.price, uint64(block.timestamp));

            if (matchingOrder.amount != 0) {
                asks.update(matchingOrder);
                break;
            }

            asks.extractMin();
        }
    }
}
