// Define a function to convert  string to hex

/*import { Bytes } from "ethers";

const stringToHex = (str: string) => {
  let hex = "";
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const hexValue = charCode.toString(16);

    // Pad with zeros to ensure two-digit representation
    hex += hexValue.padStart(2, "0");
  }
  return hex;
};

// Define a function to convert hex to string
const hexToString = (hex: string) => {
  let str = "";
  for (let i = 0; i < hex.length; i += 2) {
    const hexValue = hex.substr(i, 2);
    const decimalValue = parseInt(hexValue, 16);
    str += String.fromCharCode(decimalValue);
  }
  return str;
};

// Define a function to convert bytes to hex

const bytestoHex = (byteArray: Bytes) => {
  return Array.from(byteArray, function (byte) {
    return ("0" + (byte & 0xff).toString(16)).slice(-2);
  }).join("");
};

// Define a function to convert hex to bytes
const hexToBytes = (hex: string) => {
  var bytes = [];

  for (var c = 0; c < hex.length; c += 2) {
    bytes.push(parseInt(hex.substr(c, 2), 16));
  }

  return bytes;
};

export { stringToHex, hexToString, bytestoHex, hexToBytes };
*/
