const ReceivingStatus = [
  "Abnormal",
  "Normal, Ready",
  "Installing Hardware",
  "Restoring Hardware Data (after power loss and recovery…)"
];

const EngineStatus = ["STOP", "UP", "DOWN"];
const OverloadState = ["Normal", "Overload Error"];
const ControllerError = ["Normal", "Driver Error"];
const OnOff = ["OFF", "ON"];

export const AlertService = {
  hardwareStatusToServer(data: string) {
    const receivingStatus = ReceivingStatus[Number(data.charAt(0))];
    const engineStatus = EngineStatus[Number(data.charAt(1))];
    const hardwareVoltage = Number(data.slice(2, 4)) + "." + data.slice(4, 5);
    const percentOpeningClosing = Number(data.slice(5, 8)) + "." + data.slice(8, 9);
    const overloadState = OverloadState[Number(data.charAt(9))];
    const controllerError = ControllerError[Number(data.charAt(10))];
    const errorFlag = data.charAt(9) + data.charAt(10);
    const error =
      errorFlag === "00"
        ? "No error"
        : errorFlag === "01"
          ? controllerError
          : errorFlag === "10"
            ? overloadState
            : "Error";

    const temperature = data.slice(11, 13);

    return {
      receivingStatus,
      engineStatus,
      hardwareVoltage,
      percentOpeningClosing,
      overloadState,
      controllerError,
      error,
      temperature,
    };
  },

  sendParamInformationToServer(data: string) {
    const timer = Number(data.charAt(1));
    const percentOpeningClosing = Number(data.slice(2, 5)) + "." + data.slice(5, 6);
    const hour = data.slice(6, 8);
    const minute = data.slice(8, 10);
    const time = hour + ":" + minute;
    const sunday = OnOff[Number(data.charAt(10))];
    const monday = OnOff[Number(data.charAt(11))];
    const tuesday = OnOff[Number(data.charAt(12))];
    const wednesday = OnOff[Number(data.charAt(13))];
    const thursday = OnOff[Number(data.charAt(14))];
    const friday = OnOff[Number(data.charAt(15))];
    const saturday = OnOff[Number(data.charAt(16))];

    return {
      timer,
      percentOpeningClosing,
      time,
      sunday,
      monday,
      tuesday,
      wednesday,
      thursday,
      friday,
      saturday,
    };
  },

  messageReceivedToServer(data: string) {
    const message = data.slice(1);
    return { message };
  },
};