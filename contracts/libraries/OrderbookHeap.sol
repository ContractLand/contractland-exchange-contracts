pragma solidity 0.4.24;

library OrderBookHeap{ // default max-heap

  uint constant ROOT_INDEX = 1;

  struct Tree{
    Node[] nodes; // root is index 1; index 0 not used
    mapping (uint64 => uint) indices; // unique id => node index
  }

  struct Node{
    uint64 id;
    address owner;
    address baseToken;
    address tradeToken;
    uint price;
    uint amount;
    /* bool sell; */
    uint64 timestamp;
  }

  //call init before anything else
  function init(Tree storage self) internal{
    if(self.nodes.length == 0) self.nodes.push(Node(0,0,0,0,0,0,0));
  }

  function insert(Tree storage self, Node memory n) internal returns(Node){//√
    if(self.nodes.length == 0){ init(self); }// test on-the-fly-init
    self.nodes.length++;
    _bubbleUp(self, n, self.nodes.length-1);
    return n;
  }

  // TODO: this is a temp work around
  function update(Tree storage self, Node memory n) internal {//√
    self.nodes[n.id] = n;
  }

  function extractMax(Tree storage self) internal returns(Node){//√
    return _extract(self, ROOT_INDEX);
  }

  function extractById(Tree storage self, uint64 id) internal returns(Node){//√
    return _extract(self, self.indices[id]);
  }

  //view
  function dump(Tree storage self) internal view returns(Node[]){
  //note: Empty set will return `[Node(0,0,0,0,0,0,0)]`. uninitialized will return `[]`.
    return self.nodes;
  }

  function getById(Tree storage self, uint64 id) internal view returns(Node){
    return getByIndex(self, self.indices[id]);//test that all these return the emptyNode
  }

  function getByIndex(Tree storage self, uint i) internal view returns(Node){
    return self.nodes.length > i ? self.nodes[i] : Node(0,0,0,0,0,0,0);
  }

  function getMax(Tree storage self) internal view returns(Node){
    return getByIndex(self, ROOT_INDEX);
  }

  function size(Tree storage self) internal view returns(uint){
    return self.nodes.length > 0 ? self.nodes.length-1 : 0;
  }

  function isNode(Node n) internal pure returns(bool){ return n.id > 0; }

  function getTopK(Tree storage self, uint k) public view returns (uint[] topK) {
    /* topK = new uint[](k);
    uint[] memory candidates = new uint[](k+2);
    candidates[0] = ROOT_INDEX;
    uint candidatesLen = 1;
    uint max = 0;
    for(uint i = 0; i < k; i++) {
      max = 0;
      for (uint j = 0; j < candidatesLen; j++) {
        if (self.nodes[candidates[j]] > self.nodes[candidates[max]]) {
          max = j;
        }
      }
      topK[i] = heap[candidates[max]];
      if (candidates[max] * 2 + 1 < heap.length) {
        candidates[candidatesLen++] = candidates[max] * 2 + 1;
      }
      if (candidates[max] * 2 + 2 < heap.length) {
        candidates[candidatesLen++] = candidates[max] * 2 + 2;
      }
      candidates[max] = candidates[--candidatesLen];
    } */
  }

  //private
  function _extract(Tree storage self, uint i) private returns(Node){//√
    if(self.nodes.length <= i || i <= 0){ return Node(0,0,0,0,0,0,0); }

    Node memory extractedNode = self.nodes[i];
    delete self.indices[extractedNode.id];

    Node memory tailNode = self.nodes[self.nodes.length-1];
    self.nodes.length--;

    if(i < self.nodes.length){ // if extracted node was not tail
      _bubbleUp(self, tailNode, i);
      _bubbleDown(self, self.nodes[i], i); // then try bubbling down
    }
    return extractedNode;
  }

  function _bubbleUp(Tree storage self, Node memory n, uint i) private{//√
    if(i==ROOT_INDEX || n.price <= self.nodes[i/2].price){
      _insert(self, n, i);
    }else{
      _insert(self, self.nodes[i/2], i);
      _bubbleUp(self, n, i/2);
    }
  }

  function _bubbleDown(Tree storage self, Node memory n, uint i) private{//
    uint length = self.nodes.length;
    uint cIndex = i*2; // left child index

    if(length <= cIndex){
      _insert(self, n, i);
    }else{
      Node memory largestChild = self.nodes[cIndex];

      if(length > cIndex+1 && self.nodes[cIndex+1].price > largestChild.price ){
        largestChild = self.nodes[++cIndex];// TEST ++ gets executed first here
      }

      if(largestChild.price <= n.price){ //TEST: price 0 is valid! negative ints work
        _insert(self, n, i);
      }else{
        _insert(self, largestChild, i);
        _bubbleDown(self, n, cIndex);
      }
    }
  }

  function _insert(Tree storage self, Node memory n, uint i) private{//√
    self.nodes[i] = n;
    self.indices[n.id] = i;
  }
}
