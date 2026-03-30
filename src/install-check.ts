import type { Service } from "./types.js";

// ─── Types ───

export interface InstallCheckResult {
  install_score: number;
  install_difficulty: "easy" | "medium" | "hard" | "broken";
  details: {
    package_exists: boolean;
    package_installable: boolean;
    dependency_count: number | null;
    has_env_docs: boolean;
    install_steps: number;
    last_publish_days: number | null;
  };
}

// ─── npm Installability Check ───

export async function checkNpmInstallability(packageName: string): Promise<{
  exists: boolean;
  installable: boolean;
  dependency_count: number;
  last_publish_days: number;
}> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 404) {
      return { exists: false, installable: false, dependency_count: 0, last_publish_days: 0 };
    }

    if (!response.ok) {
      return { exists: false, installable: false, dependency_count: 0, last_publish_days: 0 };
    }

    const data = await response.json() as any;
    const latestTag = data["dist-tags"]?.latest;
    if (!latestTag) {
      return { exists: true, installable: false, dependency_count: 0, last_publish_days: 0 };
    }

    const latestVersion = data.versions?.[latestTag];
    const installable = !!latestVersion?.dist?.tarball;
    const deps = latestVersion?.dependencies ?? {};
    const dependencyCount = Object.keys(deps).length;

    const publishTime = data.time?.[latestTag];
    let lastPublishDays = 0;
    if (publishTime) {
      lastPublishDays = Math.floor(
        (Date.now() - new Date(publishTime).getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    return {
      exists: true,
      installable,
      dependency_count: dependencyCount,
      last_publish_days: lastPublishDays,
    };
  } catch {
    return { exists: false, installable: false, dependency_count: 0, last_publish_days: 0 };
  }
}

// ─── PyPI Installability Check ───

export async function checkPyPIInstallability(packageName: string): Promise<{
  exists: boolean;
  installable: boolean;
  dependency_count: number;
  last_publish_days: number;
}> {
  try {
    const response = await fetch(`https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`, {
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 404) {
      return { exists: false, installable: false, dependency_count: 0, last_publish_days: 0 };
    }

    if (!response.ok) {
      return { exists: false, installable: false, dependency_count: 0, last_publish_days: 0 };
    }

    const data = await response.json() as any;
    const requiresDist = data.info?.requires_dist ?? [];
    const dependencyCount = Array.isArray(requiresDist) ? requiresDist.length : 0;

    const urls = data.urls ?? [];
    const installable = urls.length > 0;

    let lastPublishDays = 0;
    if (urls.length > 0 && urls[0].upload_time) {
      lastPublishDays = Math.floor(
        (Date.now() - new Date(urls[0].upload_time).getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    return {
      exists: true,
      installable,
      dependency_count: dependencyCount,
      last_publish_days: lastPublishDays,
    };
  } catch {
    return { exists: false, installable: false, dependency_count: 0, last_publish_days: 0 };
  }
}

// ─── Environment Variable Documentation Check ───

export function checkEnvDocs(service: {
  required_env?: Array<{ key: string }> | null;
  description?: string;
}): boolean {
  const envVars = service.required_env;
  if (!envVars || envVars.length === 0) return true; // No env needed = good

  const desc = (service.description ?? "").toLowerCase();
  // Check if description mentions at least one env var key
  return envVars.some((env) => desc.includes(env.key.toLowerCase()));
}

// ─── Install Steps Estimation ───

export function estimateInstallSteps(service: {
  install?: { command: string } | null;
  required_env?: Array<{ key: string }> | null;
}): number {
  let steps = 0;

  if (service.install?.command) {
    steps = 1; // One command to install
  } else {
    steps = 3; // Need to find and figure out install manually
  }

  // Each env var needs configuration
  const envCount = service.required_env?.length ?? 0;
  steps += envCount;

  return steps;
}

// ─── Extract Package Name from Install Command ───

export function extractNpmPackageName(command: string): string | null {
  // Match patterns: npm install X, npx X, npx -y X, npx --yes X
  const npmInstall = command.match(/npm\s+(?:install|i)\s+(?:-[gGSD]\s+)?(@?[\w\-/.]+)/);
  if (npmInstall) return npmInstall[1];

  const npx = command.match(/npx\s+(?:-y\s+|--yes\s+)?(@?[\w\-/.]+)/);
  if (npx) return npx[1];

  return null;
}

export function extractPipPackageName(command: string): string | null {
  const pip = command.match(/pip[3]?\s+install\s+(?:-U\s+)?([a-zA-Z0-9\-_.]+)/);
  if (pip) return pip[1];

  const uvx = command.match(/uvx\s+([a-zA-Z0-9\-_.]+)/);
  if (uvx) return uvx[1];

  return null;
}

// ─── Comprehensive Install Check ───

export async function checkInstallability(service: Service): Promise<InstallCheckResult> {
  const command = service.install?.command ?? "";
  const isNpm = /\b(npm|npx)\b/.test(command);
  const isPip = /\b(pip|pip3|uvx)\b/.test(command);

  let packageExists = false;
  let packageInstallable = false;
  let dependencyCount: number | null = null;
  let lastPublishDays: number | null = null;

  if (isNpm) {
    const pkgName = extractNpmPackageName(command);
    if (pkgName) {
      const result = await checkNpmInstallability(pkgName);
      packageExists = result.exists;
      packageInstallable = result.installable;
      // Only set these when package actually exists
      if (result.exists) {
        dependencyCount = result.dependency_count;
        lastPublishDays = result.last_publish_days;
      }
    }
  } else if (isPip) {
    const pkgName = extractPipPackageName(command);
    if (pkgName) {
      const result = await checkPyPIInstallability(pkgName);
      packageExists = result.exists;
      packageInstallable = result.installable;
      if (result.exists) {
        dependencyCount = result.dependency_count;
        lastPublishDays = result.last_publish_days;
      }
    }
  } else {
    // Pure API / HTTP services — no package to install, that's a good thing
    packageExists = true;
    packageInstallable = true;
  }

  const hasEnvDocs = checkEnvDocs({
    required_env: service.required_env,
    description: service.description,
  });
  const installSteps = estimateInstallSteps(service);

  // ─── Scoring ───
  let score = 0;

  if (packageExists && packageInstallable) {
    score += 40;
  }

  if (installSteps === 1) {
    score += 20;
  } else if (installSteps === 2) {
    score += 10;
  }

  if (dependencyCount !== null && dependencyCount < 10) {
    score += 10;
  } else if (dependencyCount !== null && dependencyCount < 20) {
    score += 5;
  }

  if (hasEnvDocs) {
    score += 15;
  }

  if (lastPublishDays !== null && lastPublishDays < 30) {
    score += 15;
  } else if (lastPublishDays !== null && lastPublishDays < 90) {
    score += 10;
  }

  // ─── Difficulty Classification ───
  let difficulty: InstallCheckResult["install_difficulty"];
  if (score >= 90) {
    difficulty = "easy";
  } else if (score >= 60) {
    difficulty = "medium";
  } else if (score >= 30) {
    difficulty = "hard";
  } else {
    difficulty = "broken";
  }

  return {
    install_score: score,
    install_difficulty: difficulty,
    details: {
      package_exists: packageExists,
      package_installable: packageInstallable,
      dependency_count: dependencyCount,
      has_env_docs: hasEnvDocs,
      install_steps: installSteps,
      last_publish_days: lastPublishDays,
    },
  };
}

// ─── Batch Install Checks ───

export async function runInstallChecks(
  db: D1Database,
  services: Service[]
): Promise<{ checked: number; easy: number; medium: number; hard: number; broken: number }> {
  const stats = { checked: 0, easy: 0, medium: 0, hard: 0, broken: 0 };

  // Process in sub-batches of 5
  for (let i = 0; i < services.length; i += 5) {
    const batch = services.slice(i, i + 5);

    const results = await Promise.allSettled(
      batch.map(async (service) => {
        const result = await checkInstallability(service);
        return { serviceId: service.id, result };
      })
    );

    for (const settled of results) {
      if (settled.status !== "fulfilled") continue;
      const { serviceId, result } = settled.value;

      // Update health_summary with install data
      await db
        .prepare(
          `UPDATE health_summary
           SET install_score = ?1,
               install_difficulty = ?2,
               install_details = ?3
           WHERE service_id = ?4`
        )
        .bind(
          result.install_score,
          result.install_difficulty,
          JSON.stringify(result.details),
          serviceId
        )
        .run();

      stats.checked++;
      stats[result.install_difficulty]++;
    }
  }

  return stats;
}
