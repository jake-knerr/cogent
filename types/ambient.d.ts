// Ambient declarations: module shapes and globals that belong to no single
// source file.

// unfortunately this is the best way to fix css import type errors, but the
// checker no longer makes sure the file exists
declare module "*.css" {
  const css: string;
  export default css;
}

namespace Express {
  interface Locals {
    validation?: {
      error?: { code: string; field?: string };
    };
    [key: string]: any;
  }
}
