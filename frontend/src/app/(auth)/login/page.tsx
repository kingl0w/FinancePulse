"use client";

import { Suspense, useState, useId, useEffect } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const { login, register, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginEmailId = useId();
  const loginPasswordId = useId();
  const registerEmailId = useId();
  const registerPasswordId = useId();
  const confirmPasswordId = useId();

  useEffect(() => {
    document.title = "Sign In | FinancePulse";
    return () => { document.title = "FinancePulse"; };
  }, []);

  const handleSubmit = async (mode: "login" | "register") => {
    setError(null);
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <div className="flex flex-col items-center px-4 pt-16 sm:pt-24 pb-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Link href="/" className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold font-heading">FinancePulse</span>
          </Link>
        </div>

        <Card className="bg-card border-border py-10 px-8">
          <Tabs defaultValue="login">
            <CardHeader className="px-0 pt-0 pb-4">
              <TabsList className="grid w-full grid-cols-2 h-10">
                <TabsTrigger value="login" className="text-[13px]">Login</TabsTrigger>
                <TabsTrigger value="register" className="text-[13px]">Register</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login">
              <CardHeader className="pt-0 px-0">
                <CardTitle className="mb-1">Welcome back</CardTitle>
                <CardDescription className="mb-6">
                  Sign in to your account to continue
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit("login");
                  }}
                  className="space-y-6"
                >
                  <div>
                    <Label htmlFor={loginEmailId} className="mb-2 block">Email</Label>
                    <Input
                      id={loginEmailId}
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>
                  <div>
                    <Label htmlFor={loginPasswordId} className="mb-2 block">Password</Label>
                    <Input
                      id={loginPasswordId}
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                  <Button
                    type="submit"
                    className="w-full h-12 mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>

            <TabsContent value="register">
              <CardHeader className="pt-0 px-0">
                <CardTitle className="mb-1">Create account</CardTitle>
                <CardDescription className="mb-6">
                  Get started with FinancePulse
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit("register");
                  }}
                  className="space-y-6"
                >
                  <div>
                    <Label htmlFor={registerEmailId} className="mb-2 block">Email</Label>
                    <Input
                      id={registerEmailId}
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>
                  <div>
                    <Label htmlFor={registerPasswordId} className="mb-2 block">Password</Label>
                    <Input
                      id={registerPasswordId}
                      type="password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-12"
                    />
                  </div>
                  <div>
                    <Label htmlFor={confirmPasswordId} className="mb-2 block">Confirm Password</Label>
                    <Input
                      id={confirmPasswordId}
                      type="password"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-12"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                  <Button
                    type="submit"
                    className="w-full h-12 mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
