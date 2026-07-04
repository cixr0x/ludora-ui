import assert from "node:assert/strict";
import test from "node:test";

import { reportStoreItemClick, storeItemClickEndpoint } from "./storeClickTracking.js";

test("storeItemClickEndpoint builds the public click endpoint", () => {
  assert.equal(storeItemClickEndpoint(300, ""), "/api/store-items/300/clicks");
  assert.equal(storeItemClickEndpoint(300, "http://127.0.0.1:4000/"), "http://127.0.0.1:4000/api/store-items/300/clicks");
});

test("reportStoreItemClick uses sendBeacon when available", () => {
  const calls = [];
  const navigatorObject = {
    sendBeacon(url) {
      calls.push(url);
      return true;
    },
  };
  const fetchCalls = [];

  const reported = reportStoreItemClick(300, {
    apiBaseUrl: "",
    fetchImpl: (...args) => {
      fetchCalls.push(args);
      return Promise.resolve(new Response(null, { status: 204 }));
    },
    navigatorObject,
  });

  assert.equal(reported, true);
  assert.deepEqual(calls, ["/api/store-items/300/clicks"]);
  assert.deepEqual(fetchCalls, []);
});

test("reportStoreItemClick falls back to keepalive fetch", () => {
  const fetchCalls = [];

  const reported = reportStoreItemClick(301, {
    apiBaseUrl: "http://127.0.0.1:4000",
    fetchImpl: (...args) => {
      fetchCalls.push(args);
      return Promise.resolve(new Response(null, { status: 204 }));
    },
    navigatorObject: {},
  });

  assert.equal(reported, true);
  assert.deepEqual(fetchCalls, [
    [
      "http://127.0.0.1:4000/api/store-items/301/clicks",
      {
        keepalive: true,
        method: "POST",
      },
    ],
  ]);
});

test("reportStoreItemClick falls back when sendBeacon declines the payload", () => {
  const beaconCalls = [];
  const fetchCalls = [];

  const reported = reportStoreItemClick(302, {
    apiBaseUrl: "",
    fetchImpl: (...args) => {
      fetchCalls.push(args);
      return Promise.resolve(new Response(null, { status: 204 }));
    },
    navigatorObject: {
      sendBeacon(url) {
        beaconCalls.push(url);
        return false;
      },
    },
  });

  assert.equal(reported, true);
  assert.deepEqual(beaconCalls, ["/api/store-items/302/clicks"]);
  assert.deepEqual(fetchCalls, [
    [
      "/api/store-items/302/clicks",
      {
        keepalive: true,
        method: "POST",
      },
    ],
  ]);
});

test("reportStoreItemClick swallows async fetch rejections", () => {
  let catchHandler;

  const reported = reportStoreItemClick(303, {
    apiBaseUrl: "",
    fetchImpl: () => ({
      catch(handler) {
        catchHandler = handler;
      },
    }),
    navigatorObject: {},
  });

  assert.equal(reported, true);
  assert.equal(typeof catchHandler, "function");
  assert.equal(catchHandler(new Error("network down")), undefined);
});

test("reportStoreItemClick ignores invalid ids", () => {
  const fetchCalls = [];
  const beaconCalls = [];

  const reported = reportStoreItemClick("nope", {
    fetchImpl: (...args) => {
      fetchCalls.push(args);
      return Promise.resolve(new Response(null, { status: 204 }));
    },
    navigatorObject: {
      sendBeacon(url) {
        beaconCalls.push(url);
        return true;
      },
    },
  });

  assert.equal(reported, false);
  assert.deepEqual(fetchCalls, []);
  assert.deepEqual(beaconCalls, []);
});
