pragma solidity ^0.4.23;

library RedBlackTree {

    struct Item {
        bool red;
        uint64 parent;
        uint64 left;
        uint64 right;
        uint value;
    }

    struct Tree {
        uint64 root;
        mapping(uint64 => Item) items;
    }

    function getItem(Tree storage tree, uint64 id) internal constant returns (uint64 parent, uint64 left, uint64 right, uint value, bool red) {
        require(id != 0);
        parent = tree.items[id].parent;
        left = tree.items[id].left;
        right = tree.items[id].right;
        value = tree.items[id].value;
        red = tree.items[id].red;
    }

    function find(Tree storage tree, uint value) internal constant returns (uint64 parentId) {
        uint64 id = tree.root;
        parentId = id;
        while (id != 0) {
            if (value == tree.items[id].value) {
                return;
            }

            parentId = id;
            if (value < tree.items[id].value) {
                id = tree.items[id].left;
            } else {
                id = tree.items[id].right;
            }
        }
    }

    function insert(Tree storage tree, uint64 id, uint value) internal {
        uint64 parent = find(tree, value);
        placeAfter(tree, parent, id, value);
    }

    function placeAfter(Tree storage tree, uint64 parent, uint64 id, uint value) internal {
        Item memory item;
        item.value = value;
        item.parent = parent;
        item.red = true;
        if (parent != 0) {
            if (value < tree.items[parent].value) {
                tree.items[parent].left = id;
            } else {
                tree.items[parent].right = id;
            }
        } else {
            tree.root = id;
        }
        tree.items[id] = item;
        insert1(tree, id);
    }

    function insert1(Tree storage tree, uint64 n) private {
        uint64 p = tree.items[n].parent;
        if (p == 0) {
            tree.items[n].red = false;
        } else {
            if (tree.items[p].red) {
                uint64 g = grandparent(tree, n);
                uint64 u = uncle(tree, n);
                if (u != 0 && tree.items[u].red) {
                    tree.items[p].red = false;
                    tree.items[u].red = false;
                    tree.items[g].red = true;
                    insert1(tree, g);
                } else {
                    if ((n == tree.items[p].right) && (p == tree.items[g].left)) {
                        rotateLeft(tree, p);
                        n = tree.items[n].left;
                    } else if ((n == tree.items[p].left) && (p == tree.items[g].right)) {
                        rotateRight(tree, p);
                        n = tree.items[n].right;
                    }

                    insert2(tree, n);
                }
            }
        }
    }

    function insert2(Tree storage tree, uint64 n) internal {
        uint64 p = tree.items[n].parent;
        uint64 g = grandparent(tree, n);

        tree.items[p].red = false;
        tree.items[g].red = true;

        if ((n == tree.items[p].left) && (p == tree.items[g].left)) {
            rotateRight(tree, g);
        } else {
            rotateLeft(tree, g);
        }
    }

    function remove(Tree storage tree, uint64 n) internal {
        uint64 successor;
        uint64 nRight = tree.items[n].right;
        uint64 nLeft = tree.items[n].left;
        if (nRight != 0 && nLeft != 0) {
            successor = nRight;
            while (tree.items[successor].left != 0) {
                successor = tree.items[successor].left;
            }
            uint64 sParent = tree.items[successor].parent;
            if (sParent != n) {
                tree.items[sParent].left = tree.items[successor].right;
                tree.items[successor].right = nRight;
                tree.items[sParent].parent = successor;
            }
            tree.items[successor].left = nLeft;
            if (nLeft != 0) {
                tree.items[nLeft].parent = successor;
            }
        } else if (nRight != 0) {
            successor = nRight;
        } else {
            successor = nLeft;
        }

        uint64 p = tree.items[n].parent;
        tree.items[successor].parent = p;

        if (p != 0) {
            if (n == tree.items[p].left) {
                tree.items[p].left = successor;
            } else {
                tree.items[p].right = successor;
            }
        } else {
            tree.root = successor;
        }

        if (!tree.items[n].red) {
            if (tree.items[successor].red) {
                tree.items[successor].red = false;
            } else {
                delete1(tree, successor);
            }
        }
        delete tree.items[n];
        delete tree.items[0];
    }

    function delete1(Tree storage tree, uint64 n) private {
        uint64 p = tree.items[n].parent;
        if (p != 0) {
            uint64 s = sibling(tree, n);
            if (tree.items[s].red) {
                tree.items[p].red = true;
                tree.items[s].red = false;
                if (n == tree.items[p].left) {
                    rotateLeft(tree, p);
                } else {
                    rotateRight(tree, p);
                }
            }
            delete2(tree, n);
        }
    }

    function delete2(Tree storage tree, uint64 n) private {
        uint64 s = sibling(tree, n);
        uint64 p = tree.items[n].parent;
        uint64 sLeft = tree.items[s].left;
        uint64 sRight = tree.items[s].right;
        if (!tree.items[p].red &&
            !tree.items[s].red &&
            !tree.items[sLeft].red &&
            !tree.items[sRight].red)
        {
            tree.items[s].red = true;
            delete1(tree, p);
        } else {
             if (tree.items[p].red &&
                !tree.items[s].red &&
                !tree.items[sLeft].red &&
                !tree.items[sRight].red)
            {
                tree.items[s].red = true;
                tree.items[p].red = false;
            } else {
                if (!tree.items[s].red) {
                    if (n == tree.items[p].left &&
                        !tree.items[sRight].red &&
                        tree.items[sLeft].red)
                    {
                        tree.items[s].red = true;
                        tree.items[sLeft].red = false;
                        rotateRight(tree, s);
                    } else if (n == tree.items[p].right &&
                        !tree.items[sLeft].red &&
                        tree.items[sRight].red)
                    {
                        tree.items[s].red = true;
                        tree.items[sRight].red = false;
                        rotateLeft(tree, s);
                    }
                }

                tree.items[s].red = tree.items[p].red;
                tree.items[p].red = false;

                if (n == tree.items[p].left) {
                    tree.items[sRight].red = false;
                    rotateLeft(tree, p);
                } else {
                    tree.items[sLeft].red = false;
                    rotateRight(tree, p);
                }
            }
        }
    }

    function grandparent(Tree storage tree, uint64 n) private view returns (uint64) {
        return tree.items[tree.items[n].parent].parent;
    }

    function uncle(Tree storage tree, uint64 n) private view returns (uint64) {
        uint64 g = grandparent(tree, n);
        if (g == 0)
            return 0;

        if (tree.items[n].parent == tree.items[g].left)
            return tree.items[g].right;
        return tree.items[g].left;
    }

    function sibling(Tree storage tree, uint64 n) private view returns (uint64) {
        uint64 p = tree.items[n].parent;
        if (n == tree.items[p].left) {
            return tree.items[p].right;
        } else {
            return tree.items[p].left;
        }
    }

    function rotateRight(Tree storage tree, uint64 n) private {
        uint64 pivot = tree.items[n].left;
        uint64 p = tree.items[n].parent;
        tree.items[pivot].parent = p;
        if (p != 0) {
            if (tree.items[p].left == n) {
                tree.items[p].left = pivot;
            } else {
                tree.items[p].right = pivot;
            }
        } else {
            tree.root = pivot;
        }

        tree.items[n].left = tree.items[pivot].right;
        if (tree.items[pivot].right != 0) {
            tree.items[tree.items[pivot].right].parent = n;
        }

        tree.items[n].parent = pivot;
        tree.items[pivot].right = n;
    }

    function rotateLeft(Tree storage tree, uint64 n) private {
        uint64 pivot = tree.items[n].right;
        uint64 p = tree.items[n].parent;
        tree.items[pivot].parent = p;
        if (p != 0) {
            if (tree.items[p].left == n) {
                tree.items[p].left = pivot;
            } else {
                tree.items[p].right = pivot;
            }
        } else {
            tree.root = pivot;
        }

        tree.items[n].right = tree.items[pivot].left;
        if (tree.items[pivot].left != 0) {
            tree.items[tree.items[pivot].left].parent = n;
        }

        tree.items[n].parent = pivot;
        tree.items[pivot].left = n;
    }
}
