import { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Account = () => {
    return (
        <Layout>
            <div className="container mx-auto px-4 py-16 max-w-md">
                <h1 className="text-3xl font-heading text-center mb-8">My Account</h1>

                <Tabs defaultValue="login" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-8">
                        <TabsTrigger value="login">Login</TabsTrigger>
                        <TabsTrigger value="register">Register</TabsTrigger>
                    </TabsList>

                    <TabsContent value="login" className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" placeholder="m@example.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" type="password" />
                            </div>
                            <Button className="w-full">Login</Button>
                        </div>
                        <div className="text-center text-sm text-muted-foreground">
                            <a href="#" className="hover:underline">Forgot your password?</a>
                        </div>
                    </TabsContent>

                    <TabsContent value="register" className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input id="name" placeholder="John Doe" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="register-email">Email</Label>
                                <Input id="register-email" type="email" placeholder="m@example.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="register-password">Password</Label>
                                <Input id="register-password" type="password" />
                            </div>
                            <Button className="w-full">Create Account</Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </Layout>
    );
};

export default Account;
