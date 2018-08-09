pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "zos-lib/contracts/migrations/Initializable.sol";
import "./libraries/RedBlackTree.sol";
import "./interfaces/ERC20.sol";

contract Exchange is Initializable, Pausable {
    using SafeMath for uint;
    using RedBlackTree for RedBlackTree.Tree;

    /* --- STRUCTS / CONSTANTS --- */

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
        uint64 firstOrder;
        uint64 bestBid;
        uint64 bestAsk;
        uint64 lastOrder;
    }

    /* --- EVENTS --- */

    event CancelOrder(uint64 id);
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

    /* --- FIELDS --- */
    // ***Start of V1.0.0 storage variables***

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
        priceDenominator = 1000000000000000000;
    }

    /* --- EXTERNAL / PUBLIC  METHODS --- */

    function sell(address baseToken, address tradeToken, address owner, uint amount, uint price) public whenNotPaused payable returns (uint64) {
        require(amount != 0 &&
            price != 0 &&
            baseToken != tradeToken
        );

        // Transfer funds from user
        if (tradeToken == address(0)) {
            require(amount == msg.value);
        } else {
            ERC20(tradeToken).transferFrom(owner, this, amount);
        }
        reserved[tradeToken][owner] = reserved[tradeToken][owner].add(amount);

        Order memory order;
        order.sell = true;
        order.owner = owner;
        order.baseToken = baseToken;
        order.tradeToken = tradeToken;
        order.price = price;
        order.amount = amount;
        order.timestamp = uint64(now);

        uint64 id = ++lastOrderId;

        emit NewOrder(baseToken, tradeToken, owner, id, true, price, amount, order.timestamp);

        // Match trade
        Pair storage pair = pairs[baseToken][tradeToken];
        matchSell(pair, order, id);

        // Add remaining order to orderbook
        if (order.amount != 0) {
            addToAsks(pair, order, id);
        }

        return id;
    }

    function buy(address baseToken, address tradeToken, address owner, uint amount, uint price) public whenNotPaused payable returns (uint64) {
        require(amount != 0 &&
            price != 0 &&
            baseToken != tradeToken
        );

        // Transfer funds from user
        uint reservedAmount = amount.mul(price).div(priceDenominator);
        if(baseToken == address(0)) {
            require(msg.value == reservedAmount);
        } else {
            ERC20(baseToken).transferFrom(owner, this, reservedAmount);
        }
        reserved[baseToken][owner] = reserved[baseToken][owner].add(reservedAmount);

        Order memory order;
        order.sell = false;
        order.owner = owner;
        order.baseToken = baseToken;
        order.tradeToken = tradeToken;
        order.price = price;
        order.amount = amount;
        order.timestamp = uint64(now);

        uint64 id = ++lastOrderId;

        emit NewOrder(baseToken, tradeToken, owner, id, false, price, amount, order.timestamp);

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
            ERC20(order.tradeToken).transfer(msg.sender, order.amount);
        } else {
            reserved[order.baseToken][msg.sender] = reserved[order.baseToken][msg.sender].sub(order.amount.mul(order.price).div(priceDenominator));
            ERC20(order.baseToken).transfer(msg.sender, order.amount.mul(order.price).div(priceDenominator));
        }

        Pair storage pair = pairs[order.baseToken][order.tradeToken];
        ListItem memory orderItem = excludeItem(pair, id);
        emit CancelOrder(id);

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

    /* --- INTERNAL / PRIVATE METHODS --- */

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

    function transferFund(address token, address recipient, uint amount) private {
        if(token == address(0)) {
            recipient.transfer(amount);
        } else {
            ERC20(token).transfer(recipient, amount);
        }
    }

    function matchBuy(Pair storage pair, Order order, uint64 id) private {
        uint64 currentOrderId = pair.bestAsk;
        while (currentOrderId != 0 && order.amount > 0 && order.price >= orders[currentOrderId].price) {
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
            transferFund(order.baseToken, order.owner, tradeAmount.mul(order.price.sub(matchingOrder.price)).div(priceDenominator));
            reserved[order.tradeToken][matchingOrder.owner] = reserved[order.tradeToken][matchingOrder.owner].sub(tradeAmount);
            transferFund(order.baseToken, matchingOrder.owner, tradeAmount.mul(matchingOrder.price).div(priceDenominator));
            transferFund(order.tradeToken, order.owner, tradeAmount);

            emit NewTrade(order.baseToken, order.tradeToken, id, currentOrderId, true, tradeAmount, matchingOrder.price, uint64(now));

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
        uint64 currentOrderId;
        uint64 n = pair.pricesTree.find(order.price);
        if (n != 0 && order.price <= orders[n].price) {
            currentOrderId = pair.orderbook[n].prev;
        } else {
            currentOrderId = n;
        }

        ListItem memory orderItem;
        orderItem.prev = currentOrderId;
        uint64 prevOrderId;
        if (currentOrderId != 0) {
            prevOrderId = pair.orderbook[currentOrderId].next;
            pair.orderbook[currentOrderId].next = id;
        } else {
            prevOrderId = pair.firstOrder;
            pair.firstOrder = id;
        }

        orderItem.next = prevOrderId;
        if (prevOrderId != 0) {
            pair.orderbook[prevOrderId].prev = id;
        } else {
            pair.lastOrder = id;
        }

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
        uint64 currentOrderId;
        uint64 n = pair.pricesTree.find(order.price);
        if (n != 0 && order.price >= orders[n].price) {
            currentOrderId = pair.orderbook[n].next;
        } else {
            currentOrderId = n;
        }

        ListItem memory orderItem;
        orderItem.next = currentOrderId;
        uint64 prevOrderId;
        if (currentOrderId != 0) {
            prevOrderId = pair.orderbook[currentOrderId].prev;
            pair.orderbook[currentOrderId].prev = id;
        } else {
            prevOrderId = pair.lastOrder;
            pair.lastOrder = id;
        }

        orderItem.prev = prevOrderId;
        if (prevOrderId != 0) {
            pair.orderbook[prevOrderId].next = id;
        } else {
            pair.firstOrder = id;
        }

        emit NewAsk(order.baseToken, order.tradeToken, order.price);
        if (currentOrderId == pair.bestAsk) {
            pair.bestAsk = id;
            emit NewBestAsk(order.baseToken, order.tradeToken, order.price);
        }

        orders[id] = order;
        pair.orderbook[id] = orderItem;
        pair.pricesTree.placeAfter(n, id, order.price);
    }

    function matchSell(Pair storage pair, Order order, uint64 id) private {
        uint64 currentOrderId = pair.bestBid;
        while (currentOrderId != 0 && order.amount != 0 && order.price <= orders[currentOrderId].price) {
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
            transferFund(order.tradeToken, matchingOrder.owner, tradeAmount);
            uint baseTokenAmount = tradeAmount.mul(matchingOrder.price).div(priceDenominator);
            transferFund(order.baseToken, order.owner, baseTokenAmount);
            reserved[order.baseToken][matchingOrder.owner] = reserved[order.baseToken][matchingOrder.owner].sub(baseTokenAmount);

            emit NewTrade(order.baseToken, order.tradeToken, currentOrderId, id, false, tradeAmount, matchingOrder.price, uint64(now));

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
}
