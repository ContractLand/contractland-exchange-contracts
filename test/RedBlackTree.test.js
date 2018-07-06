const RBT = artifacts.require("./TestRedBlackTree");

contract.only("RedBlackTree", () => {
    let rbt;
    let id;

    beforeEach(function() {
        id = 0;
        return RBT.new()
            .then((res) => {
                rbt = res;
            });
    });

    afterEach(function() {
        return checkRedBlackTreeProperties()
            .then((res) => printTree());
    });

    describe("Insertion", () => {
        it("should insert a new item as root", () => {
            const value = 5;
            return insert(value)
                .then((id) => assertRoot(id))
                .then(() => assertItemState(id, {parent: 0, left:0, right: 0, value: value, red: false}));
        });

        it("should color a new node in red if parent is black", () => {
            const values = [5, 6];
            const states = [
                {value: 5, parent: 0, left: 0, right: 2, red: false},
                {value: 6, parent: 1, left: 0, right: 0, red: true}
            ];
            let ids;
            return insertValues(values)
                .then((res) => {
                    ids = res;
                    return assertStates(ids, states)
                });;
        });

        it("should color parent and uncle nodes in black if both of them are red", () => {
            const values = [10, 15, 5, 8];
            const states = [
                {value: 10, parent: 0, left: 3, right: 2, red: false},
                {value: 15, parent: 1, left: 0, right: 0, red: false},
                {value: 5, parent: 1, left: 0, right: 4, red: false},
                {value: 8, parent: 3, left: 0, right: 0, red: true}
            ];
            let ids;
            return insertValues(values)
                .then((res) => {
                    ids = res;
                    return assertStates(ids, states)
                });;
        });

        describe("when parent is red and uncle is black", () => {
            it("should handle the left left case", () => {
                const initialValues = [42, 23, 16, 15, 8, 4];
                const keyValue = 2;
                const finalStates = [
                    {value: 42, parent: 2, left: 0, right: 0, red: false},
                    {value: 23, parent: 0, left: 4, right: 1, red: false},
                    {value: 16, parent: 4, left: 0, right: 0, red: false},
                    {value: 15, parent: 2, left: 6, right: 3, red: true},
                    {value: 8, parent: 6, left: 0, right: 0, red: true},
                    {value: 4, parent: 4, left: 7, right: 5, red: false},
                    {value: 2, parent: 6, left: 0, right: 0, red: true}
                ];

                return testInsert(initialValues, keyValue, finalStates);
            });

            it("should handle the left right case", () => {
                const initialValues = [42, 23, 16, 15, 8, 4];
                const keyValue = 6;
                const finalStates = [
                    {value: 42, parent: 2, left: 0, right: 0, red: false},
                    {value: 23, parent: 0, left: 4, right: 1, red: false},
                    {value: 16, parent: 4, left: 0, right: 0, red: false},
                    {value: 15, parent: 2, left: 7, right: 3, red: true},
                    {value: 8, parent: 7, left: 0, right: 0, red: true},
                    {value: 4, parent: 7, left: 0, right: 0, red: true},
                    {value: 6, parent: 4, left: 6, right: 5, red: false}
                ];

                return testInsert(initialValues, keyValue, finalStates);
            });

            it("should handle the right right case", () => {
                const initialValues = [4, 8, 15, 16, 23, 42];
                const keyValue = 48;
                const finalStates = [
                    {value: 4, parent: 2, left: 0, right: 0, red: false},
                    {value: 8, parent: 0, left: 1, right: 4, red: false},
                    {value: 15, parent: 4, left: 0, right: 0, red: false},
                    {value: 16, parent: 2, left: 3, right: 6, red: true},
                    {value: 23, parent: 6, left: 0, right: 0, red: true},
                    {value: 42, parent: 4, left: 5, right: 7, red: false},
                    {value: 48, parent: 6, left: 0, right: 0, red: true}
                ];

                return testInsert(initialValues, keyValue, finalStates);
            });

            it("should handle the right left case", () => {
                const initialValues = [4, 8, 15, 16, 23, 42];
                const keyValue = 36;
                const finalStates = [
                    {value: 4, parent: 2, left: 0, right: 0, red: false},
                    {value: 8, parent: 0, left: 1, right: 4, red: false},
                    {value: 15, parent: 4, left: 0, right: 0, red: false},
                    {value: 16, parent: 2, left: 3, right: 7, red: true},
                    {value: 23, parent: 7, left: 0, right: 0, red: true},
                    {value: 42, parent: 7, left: 0, right: 0, red: true},
                    {value: 36, parent: 4, left: 5, right: 6, red: false}
                ];

                return testInsert(initialValues, keyValue, finalStates);
            });
        });

        function testInsert(initialValues, keyValue, finalStates) {
            let ids;
            return insertValues(initialValues)
                .then((res) => {
                    ids = res;
                    console.log("Initial tree:");
                    return printTree();
                })
                .then(() => insert(keyValue))
                .then((res) => {
                    ids.push(res);
                    return assertStates(ids, finalStates);
                });
        }
    });

    describe("Deletion", () => {
        it("should just delete red node", () => {
            const initialValues = [8, 15, 16, 4];
            const finalStates = [
                {value: 8, parent: 2, left: 0, right: 0, red: false},
                {value: 15, parent: 0, left: 1, right: 3, red: false},
                {value: 16, parent: 2, left: 0, right: 0, red: false},
            ];

            return testDelete(initialValues, 4, finalStates);
        });

        it("should delete black node, replace it with red child, and mark it black", () => {
            const initialValues = [8, 15, 16, 4];
            const finalStates = [
                undefined,
                {value: 15, parent: 0, left: 4, right: 3, red: false},
                {value: 16, parent: 2, left: 0, right: 0, red: false},
                {value: 4, parent: 2, left: 0, right: 0, red: false}
            ];

            return testDelete(initialValues, 1, finalStates);
        });

        it("should handle case when sibling is black and it's both children are black ", () => {
            const initialValues = [4, 8, 15];
            const finalStates = [
                undefined,
                {value: 8, parent: 0, left: 0, right: 3, red: false},
                {value: 15, parent: 2, left: 0, right: 0, red: true}
            ];

            return testDelete(initialValues, 1, finalStates);
        });

        describe("when sibling is black and at least one of sibling's children is red", () => {
            it("should handle the right right case", () => {
                const initialValues = [4, 8, 15, 16, 23];
                const finalStates = [
                    undefined,
                    {value: 8, parent: 4, left: 0, right: 3, red: false},
                    {value: 15, parent: 2, left: 0, right: 0, red: true},
                    {value: 16, parent: 0, left: 2, right: 5, red: false},
                    {value: 23, parent: 4, left: 0, right: 0, red: false}
                ];

                return testDelete(initialValues, 1, finalStates);
            });

            it("should handle the right left case", () => {
                const initialValues = [4, 8, 15, 12];
                const finalStates = [
                    undefined,
                    {value: 8, parent: 4, left: 0, right: 0, red: false},
                    {value: 15, parent: 4, left: 0, right: 0, red: false},
                    {value: 12, parent: 0, left: 2, right: 3, red: false}
                ];

                return testDelete(initialValues, 1, finalStates);
            });

            it("should handle the left left case", () => {
                const initialValues = [23, 16, 15, 8, 4];
                const finalStates = [
                    undefined,
                    {value: 16, parent: 4, left: 3, right: 0, red: false},
                    {value: 15, parent: 2, left: 0, right: 0, red: true},
                    {value: 8, parent: 0, left: 5, right: 2, red: false},
                    {value: 4, parent: 4, left: 0, right: 0, red: false}
                ];

                return testDelete(initialValues, 1, finalStates);
            });

            it("should handle the left right case", () => {
                const initialValues = [4, 15, 16, 8];
                const finalStates = [
                    {value: 4, parent: 4, left: 0, right: 0, red: false},
                    {value: 15, parent: 4, left: 0, right: 0, red: false},
                    undefined,
                    {value: 8, parent: 0, left: 1, right: 2, red: false}
                ];

                return testDelete(initialValues, 3, finalStates);
            });

        });

        function testDelete(initialValues, removeId, finalStates) {
            let ids;
            return insertValues(initialValues)
                .then((res) => {
                    ids = res;
                    console.log("Initial tree:");
                    return printTree();
                })
                .then(() => rbt.remove(ids[removeId - 1]))
                .then(() => assertStates(ids, finalStates));
        }

        describe("when sibling is red", () => {
            it("should handle the right case", () => {
                const initialValues = [10, 20, 30, 25, 35, 24];
                const finalStates = [
                    undefined,
                    {value: 20, parent: 3, left: 0, right: 4, red: false},
                    {value: 30, parent: 0, left: 2, right: 5, red: false},
                    {value: 25, parent: 2, left: 0, right: 0, red: true},
                    {value: 35, parent: 3, left: 0, right: 0, red: false},
                    undefined,
                ];

                return testDelete(initialValues, 6, 1, finalStates);
            });

            it("should handle the left case", () => {
                const initialValues = [30, 20, 10, 5, 15, 4];
                const finalStates = [
                    undefined,
                    {value: 20, parent: 3, left: 5, right: 0, red: false},
                    {value: 10, parent: 0, left: 4, right: 2, red: false},
                    {value: 5, parent: 3, left: 0, right: 0, red: false},
                    {value: 15, parent: 2, left: 0, right: 0, red: true},
                    undefined,
                ];

                return testDelete(initialValues, 6, 1, finalStates);
            });

            function testDelete(initialValues, initialRemoval, removeId, finalStates) {
                let ids;
                return insertValues(initialValues)
                    .then((res) => {
                        ids = res;
                    })
                    .then(() => rbt.remove(ids[initialRemoval - 1]))
                    .then(() => {
                        console.log("Initial tree:");
                        return printTree();
                    })
                    .then(() => rbt.remove(ids[removeId - 1]))
                    .then(() => assertStates(ids, finalStates));
            }
        });
    });

    function insertValues(values) {
        let pr = Promise.resolve();
        let ids = [];
        for (let i = 0; i < values.length; i++) {
            pr = pr.then(() => insert(values[i]))
                .then((res) => ids.push(res));
        }
        return pr.then(() => ids);
    }

    function insert(value) {
        return rbt.insert(++id, value)
            .then(() => id);
    }

    function assertStates(ids, states) {
        let pr = Promise.resolve();
        for (let i = 0; i < states.length; i++) {
            let state = states[i];
            if (!state) {
                continue;
            }
            pr = pr.then(() => {
                if (state.left != 0) {
                    state.left = ids[state.left - 1];
                }
                if (state.right != 0) {
                    state.right = ids[state.right - 1];
                }
                if (state.parent != 0) {
                    state.parent = ids[state.parent - 1];
                }

                let result = assertItemState(ids[i], state);
                if (state.parent == 0) {
                    result = result.then(() => assertRoot(ids[i]));
                }
                return result;
            });
        }
        return pr;
    }

    function assertRoot(id) {
        return rbt.tree()
            .then((res) => {
                assert.equal(res.toFixed(), id, "root");
            });
    }

    function assertItemState(id, state) {
        if (!state) {
            state = {parent: 0, left: 0, right: 0, value: 0, red: false};
        }
        return getItem(id)
            .then((item) => {
                assert.equal(item.parent, state.parent, "parent");
                assert.equal(item.left, state.left, "left");
                assert.equal(item.right, state.right, "right");
                assert.equal(item.value, state.value, "value");
                assert.equal(item.red, state.red, "red");
            });
    }

    function checkRedBlackTreeProperties() {
        let root;
        return rbt.tree()
            .then((res) => {
                root = res.toFixed();
                return getItem(root);
            })
            .then((res) => {
                assert.isFalse(res.red, "the root item should be black");
                return checkColorAndDepthProperties(root);
            });
    }

    let result;
    function printTree() {
        let height, size;
        let root;
        return rbt.tree()
            .then((id) => {
                root = id.toFixed();
                return getHeight(root);
            })
            .then((res) => {
                height = res;
                size = Math.pow(2, height) - 1;
                result = new Array(height);
                for (let i = 0; i < result.length; i++) {
                    result[i] = new Array(size).fill(null);
                }
                return fill(root, 0, 0, size);
            })
            .then(() => getMaxValue(root))
            .then((res) => {
                const maxValueLength = res.toString().length;
                const emptyString = emptyStr(maxValueLength);

                for (let i = 0; i < height; i++) {
                    let str = "";
                    for (let j = 0; j < size; j++) {
                        if (result[i][j] == null) {
                            str += emptyString;
                        } else {
                            let val = (result[i][j].value + emptyString).substring(0, 2);
                            str += result[i][j].red ? paintRed(val) : val;
                        }
                    }
                    console.log(str);
                }
            });
    }

    function fill(id, i, l, r) {
        if (id == 0)
            return Promise.resolve();

        let item;
        const m = Math.floor((l + r) / 2);
        return getItem(id)
            .then((res) => {
                item = res;
                result[i][m] = item;
            })
            .then(() => fill(item.left, i + 1, l, m))
            .then(() => fill(item.right, i + 1, m, r));
    }

    function getHeight(id) {
        let item, leftHeight;
        if (id == 0) {
            return Promise.resolve(0);
        }

        return getItem(id)
            .then((res) => {
                item = res;
                return getHeight(item.left, item.red);
            })
            .then((res) => {
                leftHeight = res;
                return getHeight(item.right, item.red);
            })
            .then((rightHeight) => {
                return Math.max(leftHeight, rightHeight) + 1;
            });
    }

    function getMaxValue(id) {
        let item;
        if (id == 0) {
            return Promise.resolve(0);
        }

        return getItem(id)
            .then((res) => {
                item = res;
                if (item.right == 0)
                    return item.value;
                return getMaxValue(item.right);
            });
    }

    function emptyStr(length) {
        return new Array(length + 1).join(' ');
    }

    function paintRed(str) {
        return '\x1b[31m' + str + '\x1b[0m';
    }

    function checkColorAndDepthProperties(id, parentRed) {
        let item, depth;
        if (id == 0) {
            return Promise.resolve(1);
        }

        return getItem(id)
            .then((res) => {
                item = res;
                assert.notEqual(item.value, 0);
                if (parentRed) {
                    assert.isFalse(item.red, `a child of a red parent should be black. Item #${id}(parent: #${item.parent})`);
                }
                return checkColorAndDepthProperties(item.left, item.red);
            })
            .then((leftDepth) => {
                depth = leftDepth;
                return checkColorAndDepthProperties(item.right, item.red);
            })
            .then((rightDepth) => {
                assert.equal(depth, rightDepth, `assertion failed at the node #${id}`);
                return item.red ? depth : depth + 1;
            });
    }

    function getItem(id) {
        return rbt.getItem(id)
            .then((item) => {
                return {parent: item[0].toFixed(), left: item[1].toFixed(), right: item[2].toFixed(), value: item[3].toFixed(), red: item[4]};
            });
    }
});
