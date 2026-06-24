import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";
import { LogIn, UserPlus } from "lucide-react";
import { HAS_CLERK, HAS_TEST_AUTH, readTestAuthClerkId } from "../app/auth.ts";

export function AuthControls() {
  if (HAS_TEST_AUTH) {
    return (
      <span className="meta-label hidden min-h-9 items-center rounded-full bg-newsprint px-3 md:inline-flex">
        {readTestAuthClerkId() ? "Test user" : "Test auth off"}
      </span>
    );
  }

  if (!HAS_CLERK) {
    return (
      <span className="meta-label hidden min-h-9 items-center rounded-full bg-newsprint px-3 md:inline-flex">
        Auth off
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" className="tool-button" aria-label="Sign in">
            <LogIn aria-hidden="true" size={17} />
            <span className="hidden sm:inline">Sign in</span>
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button type="button" className="tool-button bg-signal text-pitch" aria-label="Sign up">
            <UserPlus aria-hidden="true" size={17} />
            <span className="hidden sm:inline">Sign up</span>
          </button>
        </SignUpButton>
      </Show>

      <Show when="signed-in">
        <div className="flex min-h-11 items-center gap-2 rounded-full border border-ink/10 bg-paper px-2 shadow-[var(--elev-1)]">
          <span className="meta-label hidden sm:inline">Account</span>
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "h-7 w-7 rounded-full",
              },
            }}
          />
        </div>
      </Show>
    </div>
  );
}
