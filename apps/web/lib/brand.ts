/**
 * Central Brand and Navigation Configuration
 * Pure, minimal navigation hierarchy for Summit.
 */

export const BRAND = {
  name: "Summit",
  tagline: "High-Altitude Cloud Infrastructure",
  links: {
    home: "/",
    docs: "/docs",
    login: "/login",
    signup: "/dashboard",
    workspace: "/dashboard",
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
    title: string;
    href: string;
  };
}

export const NAV_DROPDOWNS: NavDropdownItem[] = [
  {
    id: "product",
    label: "Product",
    sections: [
      {
        title: "Compute",
        items: [
          {
            label: "Deployments",
            description: "Git push to global edge",
            href: "/product/deployments",
          },
          {
            label: "Serverless GPUs",
            description: "Sub-second H100 inference",
            href: "/product/gpus",
          },
          {
            label: "Private Mesh",
            description: "Wire-speed encrypted RPC",
            href: "/product/microservices",
          },
        ],
      },
      {
        title: "Storage",
        items: [
          {
            label: "Managed Postgres",
            description: "Autoscaling SQL with PITR",
            href: "/product/postgres",
          },
          {
            label: "Distributed Cache",
            description: "In-memory Redis & Valkey",
            href: "/product/cache",
          },
          {
            label: "Object Storage",
            description: "S3 with zero egress fees",
            href: "/product/storage",
          },
        ],
      },
    ],
    featured: {
      title: "Preview Environments v2.4",
      href: "/changelog/preview-environments",
    },
  },
  {
    id: "solutions",
    label: "Solutions",
    sections: [
      {
        title: "Workloads",
        items: [
          {
            label: "Full-Stack Apps",
            description: "Next.js, Remix, and Astro",
            href: "/solutions/full-stack",
          },
          {
            label: "AI & Model Serving",
            description: "vLLM, PyTorch & Ollama",
            href: "/solutions/ai-inference",
          },
          {
            label: "Background Jobs",
            description: "Scheduled event queues",
            href: "/solutions/background-jobs",
          },
        ],
      },
      {
        title: "Teams",
        items: [
          {
            label: "Platform Teams",
            description: "Internal developer portals",
            href: "/solutions/platform-engineering",
          },
          {
            label: "Agencies",
            description: "Isolated client workspaces",
            href: "/solutions/agencies",
          },
          {
            label: "Enterprise",
            description: "Dedicated VPCs & SOC 2",
            href: "/solutions/enterprise",
          },
        ],
      },
    ],
    featured: {
      title: "Enterprise Architecture Recipes",
      href: "/resources/blueprints",
    },
  },
  {
    id: "resources",
    label: "Resources",
    sections: [
      {
        title: "Documentation",
        items: [
          {
            label: "Quickstarts",
            description: "Deploy in under 60 seconds",
            href: "/docs",
          },
          {
            label: "Architecture",
            description: "Multi-region blueprints",
            href: "/resources/blueprints",
          },
          {
            label: "CLI Reference",
            description: "Local cloud emulator",
            href: "/resources/cli",
          },
        ],
      },
      {
        title: "Platform",
        items: [
          {
            label: "Changelog",
            description: "Weekly runtime updates",
            href: "/changelog",
          },
          {
            label: "System Status",
            description: "99.99% edge telemetry",
            href: "/status",
          },
          {
            label: "Community",
            description: "GitHub & developer Discord",
            href: "https://github.com/Deepanshu-2006/jetway",
          },
        ],
      },
    ],
    featured: {
      title: "Global Edge Network Status",
      href: "/status",
    },
  },
];
