declare module "tmi.js" {
  export interface TmiMessageTags {
    "display-name"?: string;
    username?: string;
    "custom-reward-id"?: string;
    emotes?: unknown;
    [key: string]: unknown;
  }

  export type TmiMessageHandler = (
    channel: string,
    tags: TmiMessageTags,
    message: string,
    self: boolean
  ) => void;

  export interface TmiClientOptions {
    options?: { debug?: boolean };
    connection?: {
      secure?: boolean;
      reconnect?: boolean;
    };
    channels?: string[];
  }

  export interface TmiClient {
    connect(): Promise<[string, number]>;
    disconnect(): Promise<[string, number]>;
    on(event: "message", listener: TmiMessageHandler): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }

  interface TmiStatic {
    Client: new (options: TmiClientOptions) => TmiClient;
  }

  const tmi: TmiStatic;
  export default tmi;
}
