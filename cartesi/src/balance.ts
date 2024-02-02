import { Address } from "viem";
class Balance {
  private account: string;
  private ether: bigint;
  private _erc20: Map<Address, bigint>;
  private _erc721: Map<Address, Set<number>>;
  constructor(
    account: string,
    ether: bigint,
    erc20: Map<Address, bigint>,
    erc721: Map<Address, Set<number>>
  ) {
    (this.account = account), (this._erc20 = erc20), (this._erc721 = erc721);
    this.ether = ether;
  }
  ether_get(): bigint {
    return this.ether;
  }
  list_erc20(): Map<Address, bigint> {
    return this._erc20;
  }
  list_erc721(): Map<Address, Set<number>> {
    return this._erc721;
  }
  erc20_get(erc20: Address): bigint | undefined {
    return this._erc20.get(erc20);
  }
  erc721_get(erc721: Address): Set<number> | undefined {
    return this._erc721.get(erc721);
  }
  ether_increase(amount: bigint): void {
    if (amount < 0) {
      throw new EvalError(
        `failed to increase balance of ether for ${this.account}`
      );
      return;
    }
    this.ether = this.ether + amount;
  }
  ether_decrease(amount: bigint): void {
    if (amount < 0) {
      throw new EvalError(
        `failed to decrease balance of ether for ${this.account}`
      );
    }

    if (this.ether < amount) {
      throw new EvalError(`failed to decrease balancefor ${this.account}`);
      return;
    }
    this.ether = this.ether - amount;
  }
  erc20_increase(erc20: Address, amount: bigint): void {
    if (amount < 0) {
      throw new EvalError(
        `failed to increase balance of ${erc20} for ${this.account}`
      );
      return;
    }
    try {
      if (this._erc20.get(erc20) === undefined) {
        this._erc20.set(erc20, BigInt(0));
      }
      this._erc20.set(
        erc20,
        BigInt(<bigint>this._erc20.get(erc20)) + BigInt(amount)
      );
      console.log("erc20 balance is ", this._erc20);
    } catch (e) {
      throw new EvalError(
        `failed to increase balance of ${erc20} for ${this.account} ${e}`
      );
    }
  }
  erc20_decrease(erc20: Address, amount: bigint): void {
    if (amount < 0) {
      throw new EvalError(
        `failed to decrease balance of ${erc20} for ${this.account} invalid amount specified`
      );
    }
    if (this._erc20.get(erc20) === undefined) {
      this._erc20.set(erc20, BigInt(0));
      throw new EvalError(
        `failed to decrease balance of ${erc20} for ${this.account} not found with erc20 balance`
      );
    }
    let erc20_balance = <bigint>this._erc20.get(erc20);
    if (erc20_balance < amount) {
      throw new EvalError(
        `failed to decrease balance of ${erc20} for ${this.account} insufficient erc20 balance`
      );
    }
    this._erc20.set(erc20, BigInt(<bigint>this._erc20.get(erc20) - amount));
  }
  erc721_add(erc721: Address, token_id: number) {
    if (this._erc721.get(erc721) === undefined) {
      this._erc721.set(erc721, new Set());
    }
    let tokens = this._erc721.get(erc721);
    if (tokens) {
      tokens.add(token_id);
    } else {
      const set: any = this._erc721.get(erc721);
      set.add(token_id);
      this._erc721.set(erc721, set);
    }
  }
  erc721_remove(erc721: Address, token_id: number) {
    if (this._erc721.get(erc721) === undefined) {
      this._erc20.set(erc721, BigInt(0));
      throw new EvalError(
        `failed to remove token ${erc721}, id:${token_id} from ${this.account}`
      );
      return;
    }
    let tokens = this._erc721.get(erc721);

    try {
      tokens?.delete(token_id);
    } catch (e) {
      throw new EvalError(
        `failed to remove token ${erc721}, id:${token_id} from ${this.account}`
      );
    }
  }
}

export { Balance };
