import { error, time } from "console";

class Item {
  erc721: string;
  token_id: number;
  constructor(erc721: string, token_id: number) {
    this.erc721 = erc721;
    this.token_id = token_id;
  }

  _eq(other: Item) {
    return this.erc721 === other.erc721 && this.token_id === other.token_id;
  }
  _ne(other: Item) {
    return this.erc721 != other.erc721 && this.token_id != other.token_id;
  }
}

class Bid {
  auction_id!: number;
  author!: string;
  amount!: number;
  timestamp!: Date;
  constructor(
    auction_id: number,
    author: string,
    amount: number,
    timestamp: Date
  ) {
    if (amount <= 0) {
      throw new EvalError(`Amount ${amount} must be greater than zero`);
      return;
    }
    this.auction_id = auction_id;
    this.author = author;
    this.amount = amount;
    this.timestamp = timestamp;
  }
  _eq(other: Bid) {
    return (
      this.author === other.author &&
      this.auction_id === other.auction_id &&
      this.amount === other.amount &&
      this.timestamp === other.timestamp
    );
  }

  _ne(other: Bid) {
    return (
      this.author != other.author &&
      this.auction_id != other.auction_id &&
      this.amount != other.amount &&
      this.timestamp != other.timestamp
    );
  }

  _gt(other: Bid) {
    return (
      this.amount > other.amount ||
      (this.amount == other.amount && this.timestamp < other.timestamp)
    );
  }

  _lt(other: Bid) {
    return (
      this.amount < other.amount ||
      (this.amount == other.amount && this.timestamp > other.timestamp)
    );
  }
}
enum Status {
  CREATED = 0,
  STARTED = 1,
  FINISHED = 2,
}
const MIN_BID_AMOUNT = 1;

class Auction {
  static curr_id: number = 0;
  id: number;
  creator: string;
  item: Item;
  erc20: string;
  title: string;
  description: string;
  start_date: Date;
  end_date: Date;
  min_bid_amount: number;
  state: Status;
  bids: Bid[];
  constructor(
    creator: string,
    item: Item,
    erc20: string,
    title: string,
    description: string,
    start_date: Date,
    end_date: Date,
    min_bid_amount: number
  ) {
    this.min_bid_amount = MIN_BID_AMOUNT;
    this.state = Status.CREATED;
    if (Auction.curr_id) {
      this.id = Auction.curr_id++;
    } else {
      Auction.curr_id = 1;
      this.id = 1;
    }
    this.creator = creator;
    this.item = item;
    this.erc20 = erc20;
    this.title = title;
    this.description = description;
    this.start_date = start_date;
    this.end_date = end_date;
    this.min_bid_amount = min_bid_amount;
    this.bids = [];
  }
  getId() {
    return this.id;
  }
  getState() {
    return this.state;
  }
  getCreator() {
    return this.creator;
  }
  getItem() {
    return this.item;
  }
  getErc20() {
    return this.erc20;
  }
  getTitle() {
    return this.title;
  }
  getDescription() {
    return this.description;
  }
  getstart_date() {
    return this.start_date;
  }
  getend_date() {
    return this.end_date;
  }
  getMinbidamount() {
    return this.min_bid_amount;
  }
  getWinning_bid(): Bid | undefined {
    if (this.bids.length === 0) {
      return undefined;
    }
    return this.bids[this.bids.length - 1];
  }
  getBids() {
    return this.bids;
  }

  bid(bid: Bid) {
    if (this.state == Status.FINISHED) {
      throw new EvalError("the auction has already been finished");
    }
    if (bid.auction_id != this.id) {
      throw new EvalError(`Auciton id ${bid.auction_id} does not match`);
    }
    if (bid.amount < this.min_bid_amount) {
      throw new EvalError(
        `Bid amount ${bid.amount} did not not meet minimum bid amount`
      );
    }
    const winning_bid = this.getWinning_bid();
    if (winning_bid === undefined || bid._gt(winning_bid)) {
      this.bids.push(bid);
    } else {
      throw new EvalError(
        `bid amoujnt ${bid.amount} is not greater than the currnent winning bid amount ${winning_bid.amount} `
      );
    }
    if (this.state === Status.CREATED) {
      this.state = Status.STARTED;
    }
  }
  finish() {
    this.state = Status.FINISHED;
  }
}

export { Auction, Bid, Item, Status };
