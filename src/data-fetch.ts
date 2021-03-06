import { AjaxWorker } from "ajax-worker";
import { IViewIntentResponse } from "./types";
import { Nav } from "./nav";
import { Url, Is } from "utility-collection";
import { RootStore } from "./state-root";
import { Helper } from "./helper";
import { IResponseOptions, IRequestOptions } from "ajax-worker/@types/interfaces";
import { process as uniq } from "uniqid";
import { Config } from "./config";
// import { intentView } from "./intent-view";

export namespace DataFetch {
  const isReactNative: boolean = false;
  // export const get origin: string | undefined = Config.options.apiOrigin;
  export function origin() {
    return Config.options.apiOrigin;
  }
  function processUrl(url: string) {
    // console.log("origin - ", (origin()));
    // console.log("processing url - ", url);
    if (origin() !== undefined) {
      // console.log("----", origin());
      const u = new Url(url);
      u.setOrigin(origin());
      return u.toString();
    } else {
      return url;
    }
  }
  export async function get<T>(url: string, data: { [prop: string]: string | number | boolean | any } | any = null): Promise<IResponseOptions<T>> {
    const u = new Url(url);
    u.setQueries(data!);
    return await genericFetch<T>(u.toString(), "get");
  }
  export async function post<T>(url: string, data: { [prop: string]: string | number | boolean | any } | any = {}): Promise<IResponseOptions<T>> {
    return await genericFetch<T>(url, "post", data);
  }
  export async function put<T>(url: string, data: { [prop: string]: string | number | boolean | any } | any = {}): Promise<IResponseOptions<T>> {
    return await genericFetch<T>(url, "put", data);
  }
  export async function patch<T>(url: string, data: { [prop: string]: string | number | boolean | any } | any = {}): Promise<IResponseOptions<T>> {
    return await genericFetch<T>(url, "patch", data);
  }
  export async function del<T>(url: string, data: { [prop: string]: string | number | boolean | any } | any = {}): Promise<IResponseOptions<T>> {
    const u = new Url(url);
    u.setQueries(data);
    return await genericFetch<T>(u.toString(), "delete");
  }
  async function genericFetch<T>(url: string, method: string, data: { [prop: string]: string | number | boolean | any } | any = {}): Promise<IResponseOptions<T>> {
    return new Promise<IResponseOptions<T>>((resolve, reject) => {
      let viewIntentedPushed: boolean = false;
      const urlDataIntent = Helper.toUrlDataIntent(url);
      if (!Is.nullOrUndefined(urlDataIntent.intent)) {
        if (!Is.nullOrUndefined(urlDataIntent.intent!.viewType) && !Is.nullOrUndefined(urlDataIntent.intent!.areaName)) {
          viewIntentedPushed = true;
          Nav.intentView(urlDataIntent.intent!, urlDataIntent.url!);
        }
      }
      if (urlDataIntent.url !== null && urlDataIntent.url !== undefined && urlDataIntent.url !== "") {
        // console.log("generic fetch -", urlDataIntent);
        AjaxWorker.fetch<T>({
          sync: true,
          id: method === "get" ? "get" : uniq().toString(),
          url: processUrl(urlDataIntent.url),
          body: method !== "get" && method !== "delete" ? data : undefined,
          method,
          redirect: "follow",
          headers: [
            ["Request", "State"],
            ["IsAjax", "true"],
            ["Accept", "application/json"],
            ["Content-Type", "application/json"],
          ],
          onSuccess: (response) => {
            // if is Intent
            if ((response.data! as IViewIntentResponse).intent !== undefined && (response.data! as IViewIntentResponse).intent !== null) {
              const data = response.data! as IViewIntentResponse;
              // contain state
              if ((response.data! as IViewIntentResponse).states !== undefined && (response.data! as IViewIntentResponse).states !== null) {
                RootStore.applyStatesRoots((response.data! as IViewIntentResponse).states!);
              }
              // nav
              if (!response.urlRedirected!.includes("p=") && !response.urlRedirected!.includes("popping=")) {
                if (!viewIntentedPushed || response.redirected) {
                  Nav.intentView(data.intent!, response.urlRedirected!);
                }
                if (!Is.empty(data.intent!.redirect)) {
                  setImmediate(async () => {
                    resolve(await DataFetch.get<T>(data.intent!.redirect!));
                  });
                } else {
                  setImmediate(async () => {
                    resolve(response);
                  });
                }
              }
            } else {
              resolve(response);
            }
          },
          onAbort: (response) => {
            reject(response);
            // console.error("aborted request", response);
          },
          onError: (response) => {
            reject(response);
            // console.error("error request", response);
          },
          onDone: (response) => {
            // console.error("done request", response);
            // console.warn("TODO: decrease the loader counter here.");
          },
        });
      }
    });
  }
}
export default DataFetch;
