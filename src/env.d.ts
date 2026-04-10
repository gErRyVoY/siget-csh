/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    session: import("@auth/core/types").Session | null;
    db: import("@prisma/client").PrismaClient;
    [key: string]: any;
  }
}
