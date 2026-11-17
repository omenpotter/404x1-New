// Ambient types for browser wallet providers injected by extensions and for Vite's
// import.meta.env. The project type-checks plain JS, so these declare what the code relies on.

export {};

declare global {
  interface Window {
    x1Wallet?: any;
    phantom?: any;
    backpack?: any;
    ethereum?: any;
    solana?: any;
  }

  interface ImportMetaEnv {
    readonly VITE_BASE44_APP_ID?: string;
    readonly VITE_BASE44_FUNCTIONS_VERSION?: string;
    readonly VITE_BASE44_APP_BASE_URL?: string;
    readonly VITE_BASE44_APP_HOST?: string;
    readonly VITE_PREVIEW_READ_ONLY?: string;
    readonly [key: string]: string | undefined;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}