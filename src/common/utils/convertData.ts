export const convertData = {
  convert: (data: string, percent?: string) => {
    switch (data) {
      case "DN":
        return "DOWN";
      case "UP":
        return "UP";
      case "ST":
        return "STOP";
      case "CF":
        return "Refresh";
      case "RS":
        return "Reset";
      case "GO":
        return `${percent}% Start`;
      case "CE":
        return "Clear Error";
      default:
        return "Unknown";
    }
  },

  converpercent: (data: number): string => {
    if (data === 100) {
      return "1000";
    } else if (data === 0) {
      return "0000";
    } else if (data >= 10) {
      const result = data * 10;
      return "0" + result;
    } else {
      const result = data * 10;
      return "00" + result;
    }
  }
};
