import { ADAPTER } from "../platform/adapt";
export function evLog(level: "debug" | "info" | "error", msg: string, ...info: any[]) {
  if (level === "debug" && !ADAPTER.conf.debug) return;
  if (level === "error") {
    console.warn(new Date().toLocaleString(), "EHVP:" + msg, ...info);
  } else {
    console.info(new Date().toLocaleString(), "EHVP:" + msg, ...info);
  }
}
