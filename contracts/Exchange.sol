pragma solidity ^0.4.23;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./libraries/RedBlackTree.sol";
import "./interfaces/ERC20.sol";

contract Exchange {
    using SafeMath for uint;
    using RedBlackTree for RedBlackTree.Tree;

    // TODO: Remove this struct. Only reserved is needed
    struct Balance {
        uint reserved;
        uint available;
    }

    struct ListItem {
        uint64 prev;
        uint64 next;
    }

    struct Order {
        //TODO: Add token addresses in Order
        address owner;
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

    mapping (address => mapping (address => Balance)) private balances;

    uint64 lastOrderId;
    mapping(uint64 => Order) orders;
    // Mapping of base token to trade token to Pair
    mapping(address => mapping(address => Pair)) pairs;

    event Deposit(address indexed token, address indexed owner, uint amount);
    event Withdraw(address indexed token, address indexed owner, uint amount);
    event NewOrder(address indexed baseToken, address indexed tradeToken, address indexed owner, uint64 id, bool sell, uint price, uint64 timestamp);
    event NewAsk(address indexed baseToken, address indexed tradeToken, uint price);
    event NewBid(address indexed baseToken, address indexed tradeToken, uint price);
    event NewTrade(address indexed baseToken, address indexed tradeToken, uint64 bidId, uint64 askId, bool side, uint amount, uint price, uint64 timestamp);

    modifier isToken(address token) {
        require(token != 0);
        _;
    }

    function Exchange() public {
    }

    function sell(address baseToken, address tradeToken, uint amount, uint price) public returns (uint64) {
        ERC20(tradeToken).transferFrom(msg.sender, this, amount);
        balances[tradeToken][msg.sender].reserved = balances[tradeToken][msg.sender].reserved.add(amount);

        Order memory order;
        order.sell = true;
        order.owner = msg.sender;
        order.price = price;
        order.amount = amount;
        order.timestamp = uint64(now);

        uint64 id = ++lastOrderId;
        NewOrder(baseToken, tradeToken, msg.sender, id, true, price, order.timestamp);

        Pair storage pair = pairs[baseToken][tradeToken];
        matchSell(baseToken, tradeToken, pair, order, id);

        if (order.amount != 0) {
            uint64 currentOrderId;
            uint64 n = pair.pricesTree.find(price);
            if (n != 0 && price >= orders[n].price) {
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

            if (currentOrderId == pair.bestAsk) {
                pair.bestAsk = id;
                NewAsk(baseToken, tradeToken, order.price);
            }

            orders[id] = order;
            pair.orderbook[id] = orderItem;
            pair.pricesTree.placeAfter(n, id, price);
        }

        return id;
    }

    function matchSell(address baseToken, address tradeToken, Pair storage pair, Order order, uint64 id) private {
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

            //TODO: Why not refund remaining tradeToken to seller here? Using matchingOrder's price only here for some reason
            balances[tradeToken][msg.sender].reserved = balances[tradeToken][msg.sender].reserved.sub(tradeAmount);
            ERC20(tradeToken).transfer(matchingOrder.owner, tradeAmount);
            ERC20(baseToken).transfer(msg.sender, tradeAmount.mul(matchingOrder.price));
            balances[baseToken][matchingOrder.owner].reserved = balances[baseToken][matchingOrder.owner].reserved.sub(tradeAmount.mul(matchingOrder.price));

            NewTrade(baseToken, tradeToken, currentOrderId, id, false, tradeAmount, matchingOrder.price, uint64(now));

            if (matchingOrder.amount != 0) {
                orders[currentOrderId] = matchingOrder;
                break;
            }

            ListItem memory item = excludeItem(pair, currentOrderId);
            currentOrderId = item.prev;
        }

        if (pair.bestBid != currentOrderId) {
            pair.bestBid = currentOrderId;
            NewBid(baseToken, tradeToken, orders[currentOrderId].price);
        }
    }

    function buy(address baseToken, address tradeToken, uint amount, uint price) public returns (uint64) {
        ERC20(baseToken).transferFrom(msg.sender, this, amount.mul(price));
        balances[baseToken][msg.sender].reserved = balances[baseToken][msg.sender].reserved.add(amount.mul(price));

        Order memory order;
        order.sell = false;
        order.owner = msg.sender;
        order.price = price;
        order.amount = amount;
        order.timestamp = uint64(now);

        uint64 id = ++lastOrderId;
        NewOrder(baseToken, tradeToken, msg.sender, id, false, price, order.timestamp);

        Pair storage pair = pairs[baseToken][tradeToken];
        matchBuy(baseToken, tradeToken, pair, order, id);

        if (order.amount != 0) {
            uint64 currentOrderId;
            uint64 n = pair.pricesTree.find(price);
            if (n != 0 && price <= orders[n].price) {
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

            if (currentOrderId == pair.bestBid) {
                pair.bestBid = id;
                NewBid(baseToken, tradeToken, order.price);
            }

            orders[id] = order;
            pair.orderbook[id] = orderItem;
            pair.pricesTree.placeAfter(n, id, order.price);
        }

        return id;
    }

    function matchBuy(address baseToken, address tradeToken, Pair storage pair, Order order, uint64 id) private {
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

            balances[baseToken][order.owner].reserved = balances[baseToken][order.owner].reserved.sub(tradeAmount.mul(order.price));
            ERC20(baseToken).transfer(order.owner, tradeAmount.mul(order.price.sub(matchingOrder.price)));
            balances[tradeToken][matchingOrder.owner].reserved = balances[tradeToken][matchingOrder.owner].reserved.sub(tradeAmount);
            ERC20(baseToken).transfer(matchingOrder.owner, tradeAmount.mul(matchingOrder.price));
            ERC20(tradeToken).transfer(order.owner, tradeAmount);

            NewTrade(baseToken, tradeToken, id, currentOrderId, true, tradeAmount, matchingOrder.price, uint64(now));

            if (matchingOrder.amount != 0) {
                orders[currentOrderId] = matchingOrder;
                break;
            }

            ListItem memory item = excludeItem(pair, currentOrderId);
            currentOrderId = item.next;
        }

        if (pair.bestAsk != currentOrderId) {
            pair.bestAsk = currentOrderId;
            NewAsk(baseToken, tradeToken, orders[currentOrderId].price);
        }
    }

    // TODO: Check other cancel conditions (see old exchange)
    function cancelOrder(address baseToken, address tradeToken, uint64 id) isToken(baseToken) public {
        Order memory order = orders[id];
        require(order.owner == msg.sender);

        if (order.sell) {
            balances[tradeToken][msg.sender].reserved = balances[tradeToken][msg.sender].reserved.sub(order.amount);
            ERC20(tradeToken).transfer(msg.sender, order.amount);
        } else {
            balances[baseToken][msg.sender].reserved = balances[baseToken][msg.sender].reserved.sub(order.amount.mul(order.price));
            ERC20(baseToken).transfer(msg.sender, order.amount.mul(order.price));
        }

        Pair storage pair = pairs[baseToken][tradeToken];
        ListItem memory orderItem = excludeItem(pair, id);

        if (pair.bestBid == id) {
            pair.bestBid = orderItem.prev;
            NewBid(baseToken, tradeToken, orders[pair.bestBid].price);
        } else if (pair.bestAsk == id) {
            pair.bestAsk = orderItem.next;
            NewAsk(baseToken, tradeToken, orders[pair.bestAsk].price);
        }
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

    function getBalance(address token, address trader) public constant returns (uint available, uint reserved) {
        available = ERC20(token).balanceOf(trader); //TODO: remove this
        reserved = balances[token][trader].reserved;
    }

    function getOrderBookInfo(address baseToken, address tradeToken) public constant returns (uint64 firstOrder, uint64 bestBid, uint64 bestAsk, uint64 lastOrder) {
        Pair memory pair = pairs[baseToken][tradeToken];
        firstOrder = pair.firstOrder;
        bestBid = pair.bestBid;
        bestAsk = pair.bestAsk;
        lastOrder = pair.lastOrder;
    }

    function getOrder(address baseToken, address tradeToken, uint64 id) public constant returns (uint price, bool sell, uint amount, uint64 next, uint64 prev) {
        Order memory order = orders[id];
        price = order.price;
        sell = order.sell;
        amount = order.amount;
        next = pairs[baseToken][tradeToken].orderbook[id].next;
        prev = pairs[baseToken][tradeToken].orderbook[id].prev;
    }
}
