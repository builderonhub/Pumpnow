import { validateEnvironment } from "./env.validation";

const base = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pumpnow",
  REDIS_URL: "redis://localhost:6379",
  RPC_URL: "https://primary.rpc.example",
  PUMP_FACTORY_ADDRESS: `0x${"1".repeat(40)}`,
  CHAIN_ID: "5042002",
};

describe("validateEnvironment", () => {
  it("requires two managed RPC endpoints on testnet", () => {
    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: "testnet",
        RPC_URLS: "https://primary.rpc.example",
      }),
    ).toThrow("primary and failover managed endpoints");
  });

  it("rejects the Arc public RPC in either managed slot", () => {
    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: "testnet",
        RPC_URLS: "https://primary.rpc.example,https://rpc.testnet.arc.network",
      }),
    ).toThrow("first two RPC_URLS entries");
  });

  it("accepts managed primary and failover with public RPC last", () => {
    expect(
      validateEnvironment({
        ...base,
        NODE_ENV: "testnet",
        RPC_URLS:
          "https://primary.rpc.example,https://failover.rpc.example,https://rpc.testnet.arc.network",
      }).RPC_URLS,
    ).toBe(
      "https://primary.rpc.example,https://failover.rpc.example,https://rpc.testnet.arc.network",
    );
  });
});
