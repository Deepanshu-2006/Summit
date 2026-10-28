/**
 * Central Brand and Navigation Configuration
 * Makes the temporary brand name and global links easy to rename or redirect later.
 */

export const BRAND = {
  name: "jetway",
  tagline: "Cloud Deployment Platform",
  links: {
    home: "/",
    docs: "/docs",
    login: "/login",
    signup: "/signup",
    pricing: "/pricing",
  },
} as const;

export interface NavItemChild {
  label: string;
  description: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItemChild[];
}

export interface NavDropdownItem {
  id: "product" | "solutions" | "resources";
  label: string;
  sections: NavSection[];
  featured?: {
    tag: string;
    title: string;
    description: string;
    href: string;
  };
}

export const NAV_DROPDOWNS: NavDropdownItem[] = [
  {
    id: "product",
    label: "Product",
    sections: [
      {
        title: "Compute & Deploy",
        items: [
          {
            label: "Instant Deployments",
            description: "Zero-config Git push to globally distributed containers",
            href: "/product/deployments",
          },
          {
            label: "Serverless GPUs",
            description: "On-demand H100 & A100 inference with fast cold starts",
            href: "/product/gpus",
          },
          {
            label: "Microservices & RPC",
            description: "Encrypted private mesh networking with internal DNS",
            href: "/product/microservices",
          },
        ],
      },
      {
        title: "Data & Storage",
        items: [
          {
            label: "Managed Postgres",
            description: "Autoscaling relational databases with point-in-time recovery",
            href: "/product/postgres",
          },
          {
            label: "Distributed Key-Value",
            description: "Ultra-low latency Valkey and Redis caching layer",
            href: "/product/cache",
          },
          {
            label: "S3-Compatible Object Store",
            description: "Fast multi-region asset storage without egress markups",
            href: "/product/storage",
          },
        ],
      },
    ],
    featured: {
      tag: "Engine v2.4",
      title: "Ephemeral Preview Envs",
      description: "Automatic preview environments for every pull request.",
      href: "/changelog/preview-environments",
    },
  },
  {
    id: "solutions",
    label: "Solutions",
    sections: [
      {
        title: "Use Cases",
        items: [
          {
            label: "Full-Stack Web Applications",
            description: "Optimized runtime for Next.js, Remix, Astro, and SvelteKit",
            href: "/solutions/full-stack",
          },
          {
            label: "AI & Model Serving",
            description: "Run custom PyTorch, vLLM, and Ollama inference endpoints",
            href: "/solutions/ai-inference",
          },
          {
            label: "Background Jobs & Queues",
            description: "Durable distributed task scheduling and event workers",
            href: "/solutions/background-jobs",
          },
        ],
      },
      {
        title: "Team Workflows",
        items: [
          {
            label: "Platform Engineering",
            description: "Self-service internal developer platforms with RBAC",
            href: "/solutions/platform-engineering",
          },
          {
            label: "Agencies & Client Projects",
            description: "Granular workspace isolation and multi-tenant billing",
            href: "/solutions/agencies",
          },
        ],
      },
    ],
  },
  {
    id: "resources",
    label: "Resources",
    sections: [
      {
        title: "Learn & Build",
        items: [
          {
            label: "Documentation",
            description: "Quickstarts, CLI references, and architecture guides",
            href: "/docs",
          },
          {
            label: "Architecture Blueprints",
            description: "Production-tested infrastructure patterns and terraform recipes",
            href: "/resources/blueprints",
          },
          {
            label: "CLI & Local Dev",
            description: "Simulate cloud topology directly in your local terminal",
            href: "/resources/cli",
          },
        ],
      },
      {
        title: "Platform Trust",
        items: [
          {
            label: "Changelog",
            description: "Weekly platform updates, new regions, and performance gains",
            href: "/changelog",
          },
          {
            label: "System Status",
            description: "Live real-time uptime metrics and incident history",
            href: "/status",
          },
        ],
      },
    ],
  },
];
