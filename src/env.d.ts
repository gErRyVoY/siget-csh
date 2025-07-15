/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    session: import("@auth/core/types").Session | null;
  }
}
