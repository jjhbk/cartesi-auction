import { hexToString } from "viem";
import { Notice, Output, Error_out, Wallet, Report } from "cartesi-wallet";
import { Router, DefaultRoute, AdvanceRoute } from "cartesi-router";
import { Auctioneer } from "./auction";
import deployments from "./rollups.json";
let rollup_address = "";
const rollup_server: string = <string>process.env.ROLLUP_HTTP_SERVER_URL;

let Network: string = "localhost";
Network = <string>process.env.Network;
console.info("rollup server url is ", rollup_server, Network);
if (Network === undefined) {
  Network = "localhost";
}

const wallet = new Wallet(new Map());
const auctioneer = new Auctioneer(wallet);
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
  execute = (request: any): Output => {
    return new Report(JSON.stringify(this.auctioneer.auctions));
  };
}

class ListBidsRoute extends InspectRoute {
  public execute = (request: any) => {
    const url = String(request).split("/");
    return this.auctioneer.auction_list_bids(parseInt(<string>url[1]));
  };
}
const router = new Router(wallet);

router.addRoute("auction_create", new CreateAuctionRoute(auctioneer));
router.addRoute("list_auctions", new ListAuctionsRoute(auctioneer));
router.addRoute("query_auction", new QueryAuctionRoute(auctioneer));
router.addRoute("list_bids", new ListBidsRoute(auctioneer));
router.addRoute("place_bid", new PlaceBidRoute(auctioneer));
router.addRoute("end_auction", new EndAuctionRoute(auctioneer));

const send_request = async (output: Output | Set<Output>) => {
  if (output instanceof Output) {
    let endpoint;
    console.log("type of output", output.type);

    if (output.type == "notice") {
      endpoint = "/notice";
    } else if (output.type == "voucher") {
      endpoint = "/voucher";
    } else {
      endpoint = "/report";
    }

    console.log(`sending request ${typeof output}`);
    const response = await fetch(rollup_server + endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(output),
    });
    console.debug(
      `received ${output.payload} status ${response.status} body ${response.body}`
    );
  } else {
    output.forEach((value: Output) => {
      send_request(value);
    });
  }
};

async function handle_advance(data: any) {
  console.log("Received advance request data " + JSON.stringify(data));
  try {
    const payload = data.payload;
    const msg_sender: string = data.metadata.msg_sender;
    console.log("msg sender is", msg_sender.toLowerCase());
    const payloadStr = hexToString(payload);

    if (
      msg_sender.toLowerCase() ===
      deployments.contracts.EtherPortal.address.toLowerCase()
    ) {
      try {
        return router.process("ether_deposit", payload);
      } catch (e) {
        return new Error_out(`failed to process ether deposti ${payload} ${e}`);
      }
    }
    if (
      msg_sender.toLowerCase() ===
      deployments.contracts.DAppAddressRelay.address.toLowerCase()
    ) {
      rollup_address = payload;
      router.set_rollup_address(rollup_address, "ether_withdraw");
      router.set_rollup_address(rollup_address, "erc20_withdraw");
      router.set_rollup_address(rollup_address, "erc721_withdraw");
      console.log("Setting DApp address");
      return new Notice(
        `DApp address set up successfully to ${rollup_address}`
      );
    }

    if (
      msg_sender.toLowerCase() ===
      deployments.contracts.ERC20Portal.address.toLowerCase()
    ) {
      try {
        return router.process("erc20_deposit", payload);
      } catch (e) {
        return new Error_out(`failed ot process ERC20Deposit ${payload} ${e}`);
      }
    }

    if (
      msg_sender.toLowerCase() ===
      deployments.contracts.ERC721Portal.address.toLowerCase()
    ) {
      try {
        return router.process("erc721_deposit", payload);
      } catch (e) {
        return new Error_out(`failed ot process ERC20Deposit ${payload} ${e}`);
      }
    }
    try {
      const jsonpayload = JSON.parse(payloadStr);
      console.log("payload is");
      return router.process(jsonpayload.method, data);
    } catch (e) {
      return new Error_out(`failed to process command ${payloadStr} ${e}`);
    }
  } catch (e) {
    console.error(e);
    return new Error_out(`failed to process advance_request ${e}`);
  }
}

async function handle_inspect(data: any) {
  console.debug(`received inspect request data${data}`);
  try {
    const url = hexToString(data.payload).split("/");
    console.log("url is ", url);
    return router.process(<string>url[0], url[1]);
  } catch (e) {
    const error_msg = `failed to process inspect request ${e}`;
    console.debug(error_msg);
    return new Error_out(error_msg);
  }
}

var handlers: any = {
  advance_state: handle_advance,
  inspect_state: handle_inspect,
};

var finish = { status: "accept" };

(async () => {
  while (true) {
    const finish_req = await fetch(rollup_server + "/finish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "accept" }),
    });

    console.log("Received finish status " + finish_req.status);

    if (finish_req.status == 202) {
      console.log("No pending rollup request, trying again");
    } else {
      const rollup_req = await finish_req.json();

      var typeq = rollup_req.request_type;
      var handler: any;
      if (typeq === "inspect_state") {
        handler = handlers.inspect_state;
      } else {
        handler = handlers.advance_state;
      }
      var output = await handler(rollup_req.data);
      finish.status = "accept";
      if (output instanceof Error_out) {
        finish.status = "reject";
      }
      await send_request(output);
    }
  }
})();
