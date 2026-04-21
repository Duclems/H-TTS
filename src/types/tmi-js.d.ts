/**
 * Typage minimal de `tmi.js` suffisant pour notre usage (connexion IRC, écoute
 * des messages). Le runtime reste celui fourni par la lib ; on ne couvre ici
 * que les membres réellement utilisés par `src/twitchChat.ts`.
 *
 * Si on a besoin d'élargir (whispers, sub events, etc.), compléter la liste
 * des signatures de `on()` ci-dessous.
 */
declare module "tmi.js" {
  /**
   * Tags IRCv3 attachés à un message Twitch. Les champs publiés ici sont ceux
   * qu'on lit dans l'app ; Twitch en envoie beaucoup d'autres (`color`,
   * `badges`, `tmi-sent-ts`, etc.) qu'on reste libre d'ajouter plus tard.
   */
  export interface TmiMessageTags {
    /** Nom d'affichage utilisateur (peut contenir des caractères unicode). */
    "display-name"?: string;
    /** Login bas-de-casse (identifiant stable). */
    username?: string;
    /** ID de la reward Channel Points quand le message est lié à un redeem. */
    "custom-reward-id"?: string;
    /**
     * Map brute `emoteId → "start-end" positions`. Twitch l'envoie sous forme
     * de string parsée par la lib en objet. On la laisse `unknown` car notre
     * parseur (`parseEmotesFromTmi`) fait sa propre validation défensive.
     */
    emotes?: unknown;
    // Twitch ajoute d'autres tags ; autorise l'accès sans casser le typage.
    [key: string]: unknown;
  }

  /** Handler d'un message chat standard. */
  export type TmiMessageHandler = (
    channel: string,
    tags: TmiMessageTags,
    message: string,
    self: boolean
  ) => void;

  /**
   * Sous-ensemble des options `tmi.Client` qu'on utilise côté Hi-TTS. La lib
   * supporte bien plus (identité, logger custom, etc.) mais on s'en tient à
   * l'essentiel pour garder une surface typée claire.
   */
  export interface TmiClientOptions {
    options?: { debug?: boolean };
    connection?: {
      secure?: boolean;
      reconnect?: boolean;
    };
    channels?: string[];
  }

  /** Client IRC Twitch instancié via `new tmi.Client(options)`. */
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
