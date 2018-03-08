export default function token (n) {
  return new web3.BigNumber(web3.toWei(n, 'ether'));
}
