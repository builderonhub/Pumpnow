import { validateEnvironment } from "./env.validation";

const base = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pumpnow",
  REDIS_URL: "redis://localhost:6379",
  RPC_URL: "https://primary.rpc.example",
  CORS_ORIGINS: "http://localhost:3000",
  PUMP_FACTORY_ADDRESS: `0x${"1".repeat(40)}`,
  CHAIN_ID: "5042002",
};

describe("validateEnvironment", () => {
  it("accepts a single public RPC on testnet", () => {
    expect(
      validateEnvironment({
        ...base,
        NODE_ENV: "testnet",
        RPC_URL: "https://rpc.testnet.arc.network",
        RPC_URLS: "https://rpc.testnet.arc.network",
      }).RPC_URLS,
    ).toBe("https://rpc.testnet.arc.network");
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

  it("rejects an invalid CORS origin", () => {
    expect(() =>
      validateEnvironment({
        ...base,
        CORS_ORIGINS: "not-a-url",
      }),
    ).toThrow();
  });
});
