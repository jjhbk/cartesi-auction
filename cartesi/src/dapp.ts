import { hexToBytes, hexToString, stringToBytes, stringToHex } from "viem";
import { Notice, Output, Voucher, Report, Error_out, Log } from "./outputs";
import { Ads, Router } from "./router";
import { Wallet } from "./wallet";
import { Auctioneer } from "./auction";
import deployments from "./rollups.json";
/*import erc20_portal from "./deployments/localhost/ERC20Portal.json";
import erc_721_portal from "./deployments/localhost/ERC721Portal.json";
import dapp_address_relay from "./deployments/localhost/DAppAddressRelay.json";
import ether_portal from "./deployments/localhost/EtherPortal.json";
console.info("MarketPlace App Started");
let Network: string = "localhost";
Network = <string>process.env.Network;
;

console.info("rollup server url is ", rollup_server, Network);
if (Network === undefined) {
  Network = "localhost";
}*/
let rollup_address = "";
const rollup_server: string = <string>process.env.ROLLUP_HTTP_SERVER_URL;
const wallet = new Wallet(new Map());
const auctioneer = new Auctioneer(wallet);
const admap = new Map<string, Ads>();
const router = new Router(auctioneer, wallet, admap);
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
      router.set_rollup_address(rollup_address);
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
