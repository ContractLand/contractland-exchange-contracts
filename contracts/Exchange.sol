pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "zos-lib/contracts/migrations/Initializable.sol";
import "./libraries/RedBlackTree.sol";
import "./interfaces/ERC20.sol";
import "./DestructibleTransfer.sol";

contract Exchange is Initializable, Pausable {
    using SafeMath for uint;
    using RedBlackTree for RedBlackTree.Tree;

    /* --- STRUCTS --- */

    struct ListItem {
        uint64 prev;
        uint64 next;
    }

    struct Order {
        address owner;
        address baseToken;
        address tradeToken;
        uint amount;
        uint price;
        bool sell;
        uint64 timestamp;
    }

    struct Pair {
        mapping (uint64 => ListItem) orderbook;
        RedBlackTree.Tree pricesTree;
        // Pointers to orders in the book from lowest to highest price
        uint64 firstOrder;
        uint64 bestBid;
        uint64 bestAsk;
        uint64 lastOrder;
    }

    /* --- EVENTS --- */

    event NewCancelOrder(uint64 id);
    event NewBestAsk(address indexed baseToken, address indexed tradeToken, uint price);
    event NewAsk(address indexed baseToken, address indexed tradeToken, uint price);
    event NewBid(address indexed baseToken, address indexed tradeToken, uint price);
    event NewBestBid(address indexed baseToken, address indexed tradeToken, uint price);

    event NewOrder(address indexed baseToken,
        address indexed tradeToken,
        address indexed owner,
        uint64 id, bool sell,
        uint price,
        uint amount,
        uint64 timestamp
    );

    event NewTrade(address indexed baseToken,
        address indexed tradeToken,
        uint64 bidId, uint64 askId,
        bool side,
        uint amount,
        uint price,
        uint64 timestamp
    );

    /* --- FIELDS / CONSTANTS --- */
    // ***Start of V1.0.0 storage variables***

    uint16 constant ORDERBOOK_MAX_ITEMS = 20;

    uint128 constant MAX_ORDER_SIZE = 1000000000000000000000000000; // 1,000,000,000 units in ether

    uint64 constant MIN_ORDER_SIZE = 10000000000000; // 0.00001 units in ether

    mapping (address => mapping (address => uint)) public reserved;

    uint64 lastOrderId;
    mapping(uint64 => Order) orders;
    // Mapping of base token to trade token to Pair
    mapping(address => mapping(address => Pair)) pairs;

    uint64 private priceDenominator; // should be 18 decimal places

    // ***End of V1.0.0 storage variables***

    /* --- CONSTRUCTOR / INITIALIZATION --- */

    function initialize() public isInitializer {
        owner = msg.sender; // initialize owner for Pausable
        priceDenominator = 1000000000000000000; // This assumes all tokens trading in exchange has 18 decimal places
    }

    /* --- EXTERNAL / PUBLIC  METHODS --- */

    function sell(address baseToken, address tradeToken, address orderOwner, uint amount, uint price) public whenNotPaused payable returns (uint64) {
        require(isValidOrder(baseToken, tradeToken, amount, price));

        // Transfer funds from user
        transferFundFromUser(orderOwner, tradeToken, amount);

        Order memory order;
        order.sell = true;
        order.owner = orderOwner;
        order.baseToken = baseToken;
        order.tradeToken = tradeToken;
        order.price = price;
        order.amount = amount;
        order.timestamp = uint64(block.timestamp);

        uint64 id = ++lastOrderId;

        emit NewOrder(baseToken, tradeToken, orderOwner, id, true, price, amount, order.timestamp);

        // Match trade
        Pair storage pair = pairs[baseToken][tradeToken];
        matchSell(pair, order, id);

        // Add remaining order to orderbook
        if (order.amount != 0) {
            addToAsks(pair, order, id);
        }

        return id;
    }

    function buy(address baseToken, address tradeToken, address orderOwner, uint amount, uint price) public whenNotPaused payable returns (uint64) {
        require(isValidOrder(baseToken, tradeToken, amount, price));

        // Transfer funds from user
        uint baseTokenAmount = amount.mul(price).div(priceDenominator);
        transferFundFromUser(orderOwner, baseToken, baseTokenAmount);

        Order memory order;
        order.sell = false;
        order.owner = orderOwner;
        order.baseToken = baseToken;
        order.tradeToken = tradeToken;
        order.price = price;
        order.amount = amount;
        order.timestamp = uint64(block.timestamp);

        uint64 id = ++lastOrderId;

        emit NewOrder(baseToken, tradeToken, orderOwner, id, false, price, amount, order.timestamp);

        // Match trade
        Pair storage pair = pairs[baseToken][tradeToken];
        matchBuy(pair, order, id);

        // Add remaining order to orderbook
        if (order.amount != 0) {
            addToBids(id, pair, order);
        }

        return id;
    }

    function cancelOrder(uint64 id) public {
        Order memory order = orders[id];
        require(order.owner == msg.sender);

        if (order.sell) {
            reserved[order.tradeToken][msg.sender] = reserved[order.tradeToken][msg.sender].sub(order.amount);
            transferFundToUser(msg.sender, order.tradeToken, order.amount);
        } else {
            reserved[order.baseToken][msg.sender] = reserved[order.baseToken][msg.sender].sub(order.amount.mul(order.price).div(priceDenominator));
            transferFundToUser(msg.sender, order.baseToken, order.amount.mul(order.price).div(priceDenominator));
        }

        Pair storage pair = pairs[order.baseToken][order.tradeToken];
        ListItem memory orderItem = excludeItem(pair, id);
        emit NewCancelOrder(id);

        if (pair.bestBid == id) {
            pair.bestBid = orderItem.prev;
            emit NewBestBid(order.baseToken, order.tradeToken, orders[pair.bestBid].price);
        } else if (pair.bestAsk == id) {
            pair.bestAsk = orderItem.next;
            emit NewBestAsk(order.baseToken, order.tradeToken, orders[pair.bestAsk].price);
        }
    }

    function getOrderBookInfo(address baseToken, address tradeToken)
        public view returns (uint64 firstOrder, uint64 bestBid, uint64 bestAsk, uint64 lastOrder) {
        Pair memory pair = pairs[baseToken][tradeToken];
        firstOrder = pair.firstOrder;
        bestBid = pair.bestBid;
        bestAsk = pair.bestAsk;
        lastOrder = pair.lastOrder;
    }

    function getOrder(uint64 id) public view returns (uint price, bool isSell, uint amount, uint64 next, uint64 prev) {
        Order memory order = orders[id];
        price = order.price;
        isSell = order.sell;
        amount = order.amount;
        next = pairs[order.baseToken][order.tradeToken].orderbook[id].next;
        prev = pairs[order.baseToken][order.tradeToken].orderbook[id].prev;
    }

    function getOrderbookBids(address baseToken, address tradeToken)
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
    }

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

    function matchSell(Pair storage pair, Order order, uint64 id) private {
        uint64 currentOrderId = pair.bestBid;
        while (currentOrderId != 0 && order.amount != 0 && 
               order.price <= orders[currentOrderId].price &&
               orders[currentOrderId].sell == false) {
            Order memory matchingOrder = orders[currentOrderId];
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

            emit NewTrade(order.baseToken, order.tradeToken, currentOrderId, id, false, tradeAmount, matchingOrder.price, uint64(block.timestamp));

            if (matchingOrder.amount != 0) {
                orders[currentOrderId] = matchingOrder;
                break;
            }

            ListItem memory item = excludeItem(pair, currentOrderId);
            currentOrderId = item.prev;
        }

        if (pair.bestBid != currentOrderId) {
            pair.bestBid = currentOrderId;
            emit NewBestBid(order.baseToken, order.tradeToken, orders[currentOrderId].price);
        }
    }
    
    function matchBuy(Pair storage pair, Order order, uint64 id) private {
        uint64 currentOrderId = pair.bestAsk;
        while (currentOrderId != 0 && order.amount > 0 && 
               order.price >= orders[currentOrderId].price &&
               orders[currentOrderId].sell == true) {
            Order memory matchingOrder = orders[currentOrderId];
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

            emit NewTrade(order.baseToken, order.tradeToken, id, currentOrderId, true, tradeAmount, matchingOrder.price, uint64(block.timestamp));

            if (matchingOrder.amount != 0) {
                orders[currentOrderId] = matchingOrder;
                break;
            }

            ListItem memory item = excludeItem(pair, currentOrderId);
            currentOrderId = item.next;
        }

        if (pair.bestAsk != currentOrderId) {
            pair.bestAsk = currentOrderId;
            emit NewBestAsk(order.baseToken, order.tradeToken, orders[currentOrderId].price);
        }
    }

    function addToBids(uint64 id, Pair storage pair, Order memory order) private {
        /**
         * id: ID of order to be added, i.e lastOrderId + 1.
         * currentOrderId: Position in the orderbook to insert new order into.
        **/
        uint64 n = pair.pricesTree.find(order.price);
        uint64 currentOrderId = n;
        if (n != 0) {
            if (order.price <= orders[currentOrderId].price) {
                // The order to insert is less or equal to the found order in the book.
                // Iterate towards the start of bid orders to find an order with lesser price or the first order
                while (orders[currentOrderId].price != 0 &&
                       order.price <= orders[currentOrderId].price) {
                    currentOrderId = pair.orderbook[currentOrderId].prev;
                }
            } else {
                // The order to insert is greater to the found order in the book.
                // Iterate towards the end of bid orders to find an order with greater price or the last order
                while (orders[currentOrderId].price != 0 &&
                       orders[currentOrderId].price == orders[pair.orderbook[currentOrderId].next].price &&
                       orders[pair.orderbook[currentOrderId].next].sell == false) {
                    currentOrderId = pair.orderbook[currentOrderId].next;
                }
            }
        }

        // Insert new order between currentOrder and currentOrder.next (right side)
        ListItem memory orderItem;
        orderItem.prev = currentOrderId;
        uint64 currentOrderNextId;
        if (currentOrderId != 0) {
            currentOrderNextId = pair.orderbook[currentOrderId].next;
            pair.orderbook[currentOrderId].next = id;
        } else {
            currentOrderNextId = pair.firstOrder;
            pair.firstOrder = id;
        }

        orderItem.next = currentOrderNextId;
        if (currentOrderNextId != 0) {
            pair.orderbook[currentOrderNextId].prev = id;
        } else {
            pair.lastOrder = id;
        }

        // Update best bid to new order if previous order at the insert position was the best bid
        emit NewBid(order.baseToken, order.tradeToken, order.price);
        if (currentOrderId == pair.bestBid) {
            pair.bestBid = id;
            emit NewBestBid(order.baseToken, order.tradeToken, order.price);
        }

        orders[id] = order;
        pair.orderbook[id] = orderItem;
        pair.pricesTree.placeAfter(n, id, order.price);
    }

    function addToAsks(Pair storage pair, Order memory order, uint64 id) private {
        uint64 n = pair.pricesTree.find(order.price);
        uint64 currentOrderId = n;
        if (n != 0) {
            if (order.price >= orders[currentOrderId].price) {
                // The order to insert is greater or equal to the found order in the book.
                // Iterate towards the end of ask orders to find a order greater price
                while (orders[currentOrderId].price != 0 &&
                       order.price >= orders[currentOrderId].price) {
                    currentOrderId = pair.orderbook[currentOrderId].next;
                }
            } else {
                // The order to insert is less than the found order in the book.
                // Iterate towards the start of ask orders to find a order where it's prev order is less than insert order price or the first order
                while (orders[currentOrderId].price != 0 &&
                       orders[currentOrderId].price == orders[pair.orderbook[currentOrderId].prev].price &&
                       orders[pair.orderbook[currentOrderId].prev].sell == true) {
                    currentOrderId = pair.orderbook[currentOrderId].prev;
                }
            }
        }

        // Insert new order between currentOrder and currentOrder.prev (left side)
        ListItem memory orderItem;
        orderItem.next = currentOrderId;
        uint64 currentOrderPrevId;
        if (currentOrderId != 0) {
            currentOrderPrevId = pair.orderbook[currentOrderId].prev;
            pair.orderbook[currentOrderId].prev = id;
        } else {
            currentOrderPrevId = pair.lastOrder;
            pair.lastOrder = id;
        }

        orderItem.prev = currentOrderPrevId;
        if (currentOrderPrevId != 0) {
            pair.orderbook[currentOrderPrevId].next = id;
        } else {
            pair.firstOrder = id;
        }
        
        // Update best ask to new order if previous order at the insert position was the best ask
        emit NewAsk(order.baseToken, order.tradeToken, order.price);
        if (currentOrderId == pair.bestAsk) {
            pair.bestAsk = id;
            emit NewBestAsk(order.baseToken, order.tradeToken, order.price);
        }

        orders[id] = order;
        pair.orderbook[id] = orderItem;
        pair.pricesTree.placeAfter(n, id, order.price);
    }

    function excludeItem(Pair storage pair, uint64 id) private returns (ListItem) {
        ListItem memory matchingOrderItem = pair.orderbook[id];
        if (matchingOrderItem.next != 0) {
            pair.orderbook[matchingOrderItem.next].prev = matchingOrderItem.prev;
        }

        if (matchingOrderItem.prev != 0) {
            pair.orderbook[matchingOrderItem.prev].next = matchingOrderItem.next;
        }

        if (pair.lastOrder == id) {
            pair.lastOrder = matchingOrderItem.prev;
        }

        if (pair.firstOrder == id) {
            pair.firstOrder = matchingOrderItem.next;
        }

        pair.pricesTree.remove(id);
        delete pair.orderbook[id];
        delete orders[id];

        return matchingOrderItem;
    }
}
