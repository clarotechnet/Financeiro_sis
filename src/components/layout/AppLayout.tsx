import React from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';

export const AppLayout: React.FC = () => (
    <SidebarProvider>
        <div className="min-h-svh flex w-full min-w-0 bg-background">
            <AppSidebar />
            <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-hidden">
                <AppHeader />
                <main className="app-main min-w-0 max-w-full flex-1 overflow-x-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    </SidebarProvider>
);

export default AppLayout;
