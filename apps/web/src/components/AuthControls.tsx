import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";
import { LogIn, UserPlus } from "lucide-react";
import { HAS_CLERK } from "../app/auth.ts";

export function AuthControls() {
  if (!HAS_CLERK) {
    return (
      <span className="hidden min-h-10 items-center rounded-full border-2 border-ink bg-newsprint px-3 font-mono text-xs font-black text-ink md:inline-flex">
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
          <button type="button" className="tool-button bg-signal" aria-label="Sign up">
            <UserPlus aria-hidden="true" size={17} />
            <span className="hidden sm:inline">Sign up</span>
          </button>
        </SignUpButton>
      </Show>

      <Show when="signed-in">
        <div className="flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-paper px-2 shadow-hard">
          <span className="hidden font-mono text-xs font-black sm:inline">Account</span>
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "h-7 w-7 rounded-none",
              },
            }}
          />
        </div>
      </Show>
    </div>
  );
}
