import { getAddress } from "viem";
import { Auction, Bid, Item, Status } from "./model";
import { Wallet } from "./wallet";
import { Error_out, Log, Notice, Output } from "./outputs";

class Auctioneer {
  auctions: Map<number, Auction> = new Map<number, Auction>();
  wallet: Wallet;
  constructor(wallet: Wallet) {
    this.auctions = new Map();
    this.wallet = wallet;
  }
  auction_create = (
    seller: string,
    item: Item,
    erc20: string,
    title: string,
    description: string,
    min_bid_amount: number,
    start_date: Date,
    end_date: Date,
    current_date: Date
  ) => {
    try {
      if (start_date < current_date) {
        throw new EvalError(
          `start date ${start_date.toISOString()} must be in the future`
        );
      }
      if (!this.seller_owns_item(seller, item)) {
        throw new EvalError(
          `seller ${seller} must own item ERC-721 ${item.erc721},id: ${item.token_id} to auction it`
        );
      }

      if (!this.is_item_auctinable(item)) {
        throw new EvalError(
          `seller ${seller} must own item ERC-721 ${item.erc721},id: ${item.token_id} to auction it`
        );
      }
      let auction = new Auction(
        seller,
        item,
        erc20,
        title,
        description,
        start_date,
        end_date,
        min_bid_amount
      );
      this.auctions.set(auction.id, auction);
      let auction_json = JSON.stringify(auction);
      const notice_payload = `{{"type":"auction_create","content":${auction_json}}}`;
      console.log(
        `Auction ${auction.id} created for item ERC-721 ${item.erc721},id:${item.token_id}`
      );
      return new Notice(notice_payload);
      //   if (!this.seller_owns_item(seller, item)) {
      //     throw new EvalError(
      //       `Seller ${seller} must own item ${item.erc721} id:${item.token_id} to auction it`
      //     );
      //   }
    } catch (e) {
      const error_msg = `Failed to create auction ${e}`;
      console.debug(error_msg);

      return new Error_out(error_msg);
    }
  };

  auction_list_bids(auction_id: number) {
    try {
      let auction = this.auctions.get(auction_id);
      if (auction == null) {
        throw new EvalError(`Auction id ${auction_id} not found`);
      }
      return new Log(JSON.stringify(auction.bids));
    } catch (e) {
      let error_msg = `failed to list bids for auction id ${auction_id} ${e}`;
      console.debug(error_msg);
      return new Error_out(error_msg);
    }
  }

  auction_bid(
    bidder: string,
    auction_id: number,
    amount: number,
    timestamp: Date
  ) {
    try {
      const auction = this.auctions.get(auction_id);
      if (!auction) {
        throw new EvalError(`There's no auction with id ${auction_id}`);
      }
      if (bidder === auction.creator) {
        throw new EvalError(`${bidder} cannot bid on their own auction`);
      }
      /*if (timestamp < auction.start_date) {
        throw new EvalError(
          `Bid arrived before auction start date ${auction.start_date.toISOString()}`
        );
      }
      if (timestamp > auction.end_date) {
        throw new EvalError(`Account ${bidder} doesn't have enough funds`);
      }*/
      if (!this.has_enough_funds(auction.erc20, bidder, amount)) {
        throw new EvalError(`Account ${bidder} doesn't have enough funds`);
      }
      const new_bid = new Bid(auction_id, bidder, amount, timestamp);
      auction.bid(new_bid);
      const bid_json = JSON.stringify(new_bid);
      console.log(`Bid of ${amount} ${auction.erc20} placed for ${auction_id}`);
      return new Notice(`{{"type":"auction_bid","content":${bid_json}}}`);
    } catch (e) {
      const error_msg = `failed to bid ${e}`;
      console.debug(error_msg);
      return new Error_out(error_msg);
    }
  }

  auction_end(
    auction_id: number,
    rollup_address: string,
    msg_date: Date,
    msg_sender: string,
    withdraw: boolean
  ) {
    try {
      const auction = <Auction>this.auctions.get(auction_id);
      if (!auction) {
        throw new EvalError(`There's no auction with id ${auction_id}`);
      }
      /*if (msg_date < auction.end_date) {
        throw new EvalError(
          `It can onlu end after ${auction.end_date.toISOString()}`
        );
      }*/
      let notice_template = { type: "auction_end", content: {} };
      let winning_bid = auction.getWinning_bid();
      let outputs = new Set<Output>();
      if (!winning_bid) {
        let notice_payload = (notice_template.content = {
          auction_id: auction.id,
        });
        let notice = new Notice(JSON.stringify(notice_payload));
        outputs.add(notice);
      } else {
        let output = this.wallet.erc20_transfer(
          getAddress(winning_bid.author),
          getAddress(auction.creator),
          getAddress(auction.erc20),
          BigInt(winning_bid.amount.toString())
        );
        if (typeof output == typeof Error_out) {
          return output;
        }
        outputs.add(output);
        output = this.wallet.erc721_transfer(
          getAddress(auction.creator),
          getAddress(winning_bid.author),
          getAddress(auction.item.erc721),
          auction.item.token_id
        );
        if (typeof output === typeof Error_out) {
          return output;
        }
        const winnig_bid = auction.getWinning_bid();
        if (winnig_bid === undefined) {
          return new Error_out("winning bid not defined");
        }
        if (withdraw && msg_sender === winnig_bid.author) {
          output = this.wallet.erc721_withdraw(
            getAddress(rollup_address),
            getAddress(msg_sender),
            getAddress(auction.item.erc721),
            auction.item.token_id
          );
          if (typeof output === typeof Error_out) {
            return output;
          }
          outputs.add(output);
          const bid_str = JSON.stringify(winning_bid);
          const notice_payload = (notice_template.content = bid_str);
          const notice = new Notice(notice_payload);
          outputs.add(notice);
        }
      }
      auction.finish();
      console.info(`Auction ${auction.id} finished`);
      return outputs;
    } catch (e) {
      const error_msg = `failed to end acution ${e}`;
      console.debug(error_msg);

      return new Error_out(error_msg);
    }
  }

  auction_get(auction_id: number) {
    try {
      let auction_json = JSON.stringify(this.auctions.get(auction_id));
      return new Log(auction_json);
    } catch (e) {
      return new Error_out(`Auction id ${auction_id} not found`);
    }
  }

  seller_owns_item(seller: string, item: Item) {
    try {
      const balance = this.wallet.balance_get(getAddress(seller));
      const erc721_balance = balance.erc721_get(getAddress(item.erc721));
      if (erc721_balance === undefined) {
        return false;
      }
      if (erc721_balance.has(item.token_id)) {
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  is_item_auctinable(item: Item): boolean {
    this.auctions.forEach((auction: Auction, key: number) => {
      if (auction.state != Status.FINISHED && auction.item._eq(item)) {
        return false;
      }
    });
    return true;
  }
  has_enough_funds(erc20: string, bidder: string, amount: number) {
    let balance = this.wallet.balance_get(getAddress(bidder));
    let erc20_balance = balance.erc20_get(getAddress(erc20));
    if (erc20 === undefined) {
      return false;
    }
    return BigInt(amount) <= <bigint>erc20_balance;
  }
}

export { Auctioneer };
