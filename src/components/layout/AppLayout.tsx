import React from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';

export const AppLayout: React.FC = () => (
    <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <AppHeader />
                <main className="flex-1 overflow-x-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    </SidebarProvider>
);

export default AppLayout;