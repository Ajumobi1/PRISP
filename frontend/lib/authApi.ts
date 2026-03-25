import type { AccountStatus, AccountUser, SessionUser, StoredUser } from "./accountTypes";
import { nowIso } from "./accountTypes";
import { generateId } from "./idUtils";
import * as clientStorage from "./clientStorage";
import { toSessionUser, createAdminUser } from "./accountCore";

// All storage and browser logic is now in clientStorage.ts
// All universal logic is in accountCore.ts

// Use clientStorage.getCurrentUserId()

// Use clientStorage and accountCore helpers in client-only code

  // Move all logic to a client-only hook or component
  throw new Error("loginSession must be called from a client-only context.");
}

  // Move all logic to a client-only hook or component
  throw new Error("logoutSession must be called from a client-only context.");
}

  // Move all logic to a client-only hook or component
  throw new Error("getCurrentSession must be called from a client-only context.");
}

  // Move all logic to a client-only hook or component
  throw new Error("registerAccount must be called from a client-only context.");
}

  // Move all logic to a client-only hook or component
  throw new Error("fetchAdminUsers must be called from a client-only context.");
}

  // Move all logic to a client-only hook or component
  throw new Error("updateAdminUserStatus must be called from a client-only context.");
}
