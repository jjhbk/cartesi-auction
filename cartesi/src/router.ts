import { hexToString, getAddress } from "viem";
import { Error_out, Log, Notice, Output, Report } from "./outputs";
import { Wallet } from "./wallet";
import { Auctioneer } from "./auction";

class DefaultRoute {
  public execute = (request: any): Output | Set<Output> => {
    return new Error_out("Operation not implemented");
  };
}

const Default_Adprice = BigInt(10000000);
const Default_price_perView = BigInt(100000);
class Ads {
  views: number;
  ad_price: bigint;
  constructor(views: number, ad_price: bigint) {
    this.views = views;
    this.ad_price = ad_price;
  }
}

class AdvanceRoute extends DefaultRoute {
  msg_sender!: string;
  msg_timestamp!: Date;
  request_args: any;
  public parse_request = (request: any) => {
    this.msg_sender = request.metadata.msg_sender;
    this.msg_timestamp = new Date(request.metadata.timestamp);
    const request_payload = JSON.parse(hexToString(request["payload"]));
    this.request_args = request_payload["args"];
  };
  public execute = (request: any): Output | Set<Output> => {
    if (request) {
      this.parse_request(request);
    }
    return new Log("parsing advance state request");
  };
}
class Mint_NFTRoute extends DefaultRoute {
  imgdata!: string;
  constructor() {
    super();
  }

  public execute = (request: any) => {
    this.imgdata = request;
    console.log("request is", request);
    return new Notice(String(request.payload));
  };
}

class CalculateAdpriceRoute extends AdvanceRoute {
  admap: Map<string, Ads>;
  constructor(admap: Map<string, Ads>) {
    super();
    this.admap = admap;
  }
  public execute = (request: any) => {
    this.parse_request(request);

    if (this.admap.get(this.request_args.address) === undefined) {
      this.admap.set(this.request_args.address, new Ads(0, Default_Adprice));
    }
    var ad = <Ads>this.admap.get(this.request_args.address);
    ad.views += 1;
    ad.ad_price = ad?.ad_price + Default_price_perView * BigInt(ad.views);
    this.admap.set(this.request_args.address, ad);
    return new Notice(
      `{{"address":${this.request_args.address},"adprice":${ad.ad_price}}}`
    );
  };
}

class WalletRoute extends AdvanceRoute {
  wallet: Wallet;
  constructor(wallet: Wallet) {
    super();
    this.wallet = wallet;
  }
}

class DepositEther extends WalletRoute {
  public execute = (request: any) => {
    return this.wallet.ether_deposit_process(request);
  };
}

class DepositERC20Route extends WalletRoute {
  execute = (request: any) => {
    return this.wallet.erc20_deposit_process(request);
  };
}

class DepositERC721Route extends WalletRoute {
  execute = (request: any) => {
    return this.wallet.erc721_deposit_process(request);
  };
}

class BalanceRoute extends WalletRoute {
  public execute = (request: any) => {
    console.log("request is ", request);
    const accbalance = this.wallet.balance_get(getAddress(request));
    console.log("complete balance is", accbalance);
    try {
      const ether = accbalance.ether_get().toString();
      const erc20: Map<`0x${string}`, any> = accbalance.list_erc20();
      let erc20new = new Map();
      let erc721new = new Map();
      const erc721: any = accbalance.list_erc721();
      for (let [key, value] of erc20) {
        erc20new.set(key, value.toString());
      }
      console.log(ether, erc20, erc721);
      for (let [key, value] of erc721) {
        erc721new.set(key, Array.from(value));
      }
      return new Report(
        JSON.stringify({
          ether: ether,
          erc20: Array.from(erc20new),
          erc721: Array.from(erc721new),
        })
      );
    } catch (e) {
      return new Error_out(String(e));
    }
  };
}

class WithdrawEther extends WalletRoute {
  rollup_address: any;
  constructor(wallet: Wallet) {
    super(wallet);
    this.rollup_address = null;
  }
  public get_rollup_address = () => {
    return this.rollup_address;
  };
  public set_rollup_address = (value: string) => {
    this.rollup_address = value;
  };

  public execute = (request: any): Output => {
    this.parse_request(request);
    if (!this.rollup_address) {
      return new Error_out("DApp address is needed to withdraw the assett");
    }
    return this.wallet.ether_withdraw(
      getAddress(this.rollup_address),
      getAddress(this.msg_sender),
      BigInt(this.request_args.amount)
    );
  };
}

class TransferEther extends WalletRoute {
  public execute = (request: any) => {
    this.parse_request(request);
    return this.wallet.ether_transfer(
      getAddress(this.msg_sender),
      getAddress(this.request_args.to.toLowerCase()),
      BigInt(this.request_args.amount)
    );
  };
}

class WithdrawERC20Route extends WalletRoute {
  public execute = (request: any): Output => {
    this.parse_request(request);
    return this.wallet.erc20_withdraw(
      getAddress(this.msg_sender),
      getAddress(this.request_args.erc20.toLowerCase()),
      BigInt(this.request_args.amount)
    );
  };
}

class TransferERC20Route extends WalletRoute {
  public execute = (request: any): Output => {
    this.parse_request(request);
    return this.wallet.erc20_transfer(
      getAddress(this.msg_sender),
      getAddress(this.request_args.to.toLowerCase()),
      getAddress(this.request_args.erc20.toLowerCase()),
      BigInt(this.request_args.amount)
    );
  };
}

class WithdrawERC721Route extends WalletRoute {
  rollup_address: any;
  constructor(wallet: Wallet) {
    super(wallet);
    this.rollup_address = null;
  }
  public get_rollup_address = () => {
    return this.rollup_address;
  };
  public set_rollup_address = (value: string) => {
    this.rollup_address = value;
  };
  public execute = (request: any) => {
    this.parse_request(request);
    if (!this.rollup_address) {
      return new Error_out("DApp address is needed to withdraw the assett");
    }
    return this.wallet.erc721_withdraw(
      getAddress(this.rollup_address),
      getAddress(this.msg_sender),
      getAddress(this.request_args.erc721.toLowerCase()),
      parseInt(this.request_args.token_id)
    );
  };
}

class TransferERC721Route extends WalletRoute {
  public execute = (request: any) => {
    this.parse_request(request);
    return this.wallet.erc721_transfer(
      getAddress(this.msg_sender),
      getAddress(this.request_args.to.toLowerCase()),
      getAddress(this.request_args.erc721.toLowerCase()),
      parseInt(this.request_args.token_id)
    );
  };
}

class AuctioneerRoute extends AdvanceRoute {
  auctioneer: Auctioneer;
  constructor(auctioneer: Auctioneer) {
    super();
    this.auctioneer = auctioneer;
  }
}
class CreateAuctionRoute extends AuctioneerRoute {
  _parse_request(request: any) {
    this.parse_request(request);
    this.request_args["erc20"] = this.request_args["erc20"].toLowerCase();
    const erc721 = this.request_args["item"]["erc721"].toLowerCase();
    this.request_args["start_date"] = new Date(this.request_args["start_date"]);
    this.request_args["end_date"] = new Date(this.request_args["end_date"]);
  }
  public execute = (request: any) => {
    this._parse_request(request);
    return this.auctioneer.auction_create(
      this.msg_sender,
      this.request_args.item,
      this.request_args.erc20,
      this.request_args.title,
      this.request_args.description,
      parseInt(this.request_args.min_bid_amount),
      this.request_args.start_date,
      this.request_args.end_date,
      this.msg_timestamp
    );
  };
}

class EndAuctionRoute extends AuctioneerRoute {
  rollup_address: string;
  constructor(auctioneer: Auctioneer) {
    super(auctioneer);
    this.rollup_address = "null";
  }
  getRollup_address() {
    this.rollup_address;
  }
  setRollup_address(value: string) {
    this.rollup_address = value;
  }
  public execute = (request: any) => {
    this.parse_request(request);
    if (this.rollup_address === "null") {
      return new Error_out(
        "DApp address is needed to end an Auction Check Dapp documentation on how to proper set the Dapp address"
      );
    }
    return this.auctioneer.auction_end(
      parseInt(this.request_args.auction_id),
      this.rollup_address,
      this.msg_timestamp,
      this.msg_sender,
      this.request_args.withdraw
    );
  };
}

class PlaceBidRoute extends AuctioneerRoute {
  public execute = (request: any) => {
    this.parse_request(request);
    return this.auctioneer.auction_bid(
      this.msg_sender,
      parseInt(this.request_args.auction_id),
      parseInt(this.request_args.amount),
      this.msg_timestamp
    );
  };
}

class InspectRoute extends DefaultRoute {
  auctioneer: Auctioneer;
  constructor(auctioneer: Auctioneer) {
    super();
    this.auctioneer = auctioneer;
  }
}

class QueryAuctionRoute extends InspectRoute {
  public execute = (request: any) => {
    const req = String(request).split("/");
    return this.auctioneer.auction_get(parseInt(<string>req[1]));
  };
}

class ListAuctionsRoute extends InspectRoute {
  public execute = (request: any) => {
    return new Report(JSON.stringify(this.auctioneer.auctions));
  };
}

class ListBidsRoute extends InspectRoute {
  public execute = (request: any) => {
    const url = String(request).split("/");
    return this.auctioneer.auction_list_bids(parseInt(<string>url[1]));
  };
}
class Router {
  controllers: Map<string, DefaultRoute>;
  constructor(auctioneer: Auctioneer, wallet: Wallet, admap: Map<string, Ads>) {
    this.controllers = new Map();
    this.controllers.set("ether_deposit", new DepositEther(wallet));
    this.controllers.set("erc20_deposit", new DepositERC20Route(wallet));
    this.controllers.set("erc721_deposit", new DepositERC721Route(wallet));
    this.controllers.set("balance", new BalanceRoute(wallet));
    this.controllers.set("ether_withdraw", new WithdrawEther(wallet));
    this.controllers.set("ether_transfer", new TransferEther(wallet));
    this.controllers.set("erc20_withdraw", new WithdrawERC20Route(wallet));
    this.controllers.set("erc20_transfer", new TransferERC20Route(wallet));
    this.controllers.set("erc721_withdraw", new WithdrawERC721Route(wallet));
    this.controllers.set("erc721_transfer", new TransferERC721Route(wallet));
    this.controllers.set("create_nft", new Mint_NFTRoute());
    this.controllers.set("auction_create", new CreateAuctionRoute(auctioneer));
    this.controllers.set("list_auctions", new ListAuctionsRoute(auctioneer));
    this.controllers.set("query_auction", new QueryAuctionRoute(auctioneer));
    this.controllers.set("list_bids", new ListBidsRoute(auctioneer));
    this.controllers.set("place_bid", new PlaceBidRoute(auctioneer));
    this.controllers.set("end_auction", new EndAuctionRoute(auctioneer));
    this.controllers.set("calculate_adprice", new CalculateAdpriceRoute(admap));
  }
  set_rollup_address(rollup_address: string) {
    const controller = <WithdrawERC721Route>(
      this.controllers.get("erc721_withdraw")
    );
    controller.set_rollup_address(rollup_address);

    const controller2 = <WithdrawEther>this.controllers.get("ether_withdraw");
    controller2.set_rollup_address(rollup_address);
    const controller3 = <EndAuctionRoute>this.controllers.get("end_auction");
    controller3.setRollup_address(rollup_address);
  }
  process(route: string, request: any) {
    route = route.toLowerCase();
    const controller = this.controllers.get(route);
    if (!controller) {
      return new Error_out(`operation ${route} is not supported`);
    }
    console.info(`executing operation ${route}`);
    return controller.execute(request);
  }
}
export { Router, Ads };
