import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    DollarSign, Wallet, BarChart3, PieChart, Layers, Table as TableIcon, Coins, ChevronDown, Settings, FileBarChart, TrendingUp, Gift, Fuel, PackagePlus,
} from 'lucide-react';
import {
    Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
    SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton,
    SidebarMenuSubItem, SidebarHeader, useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/useAuth';
import { canAccessFinancialReports, ROLE_FINANCE_ASSISTANT, ROLE_RH } from '@/lib/profileRoles';

interface SubItem { id: string; label: string; icon: React.ComponentType<{ className?: string }>; }

const RELATORIOS_TABS: SubItem[] = [
    { id: 'charts', label: 'KPIs', icon: PieChart },
    { id: 'table', label: 'Lançamentos', icon: TableIcon },
    { id: 'valores', label: 'Valores', icon: Coins },
];

const FOLHA_TABS: SubItem[] = [
    { id: 'kpis', label: 'KPIs', icon: BarChart3 },
    { id: 'charts', label: 'Gráficos', icon: PieChart },
    { id: 'frentes', label: 'Frentes', icon: Layers },
    { id: 'table', label: 'Dados Detalhados', icon: TableIcon },
];

const BENEFICIOS_TABS: SubItem[] = [
    { id: 'combustivel', label: 'Combustível', icon: Fuel },
    { id: 'agregamento', label: 'Agregamento', icon: PackagePlus },
];


export const AppSidebar: React.FC = () => {
    const { pathname, search } = useLocation();
    const { isAdmin, profile } = useAuth();
    const { state } = useSidebar();
    const collapsed = state === 'collapsed';

    const currentTab = new URLSearchParams(search).get('tab') || 'frentes';
    const canAccessSettings = isAdmin || profile?.role === ROLE_RH || profile?.role === ROLE_FINANCE_ASSISTANT;
    const canViewFinancialReports = canAccessFinancialReports(profile?.role);

    const renderModule = (
        basePath: string,
        label: string,
        Icon: React.ComponentType<{ className?: string }>,
        tabs: SubItem[],
    ) => {
        const isOnRoute = pathname === basePath && tabs.some(tab => tab.id === currentTab);
        return (
            <Collapsible defaultOpen={isOnRoute} className="group/collapsible">
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                            isActive={isOnRoute}
                            className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground h-auto min-h-9 py-2"
                        >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            {!collapsed && (
                                <>
                                    <span className="flex-1 text-left text-[13px] leading-tight whitespace-normal break-words">{label}</span>
                                    <ChevronDown className="h-4 w-4 flex-shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                                </>
                            )}
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                    {!collapsed && (
                        <CollapsibleContent>
                            <SidebarMenuSub>
                                {tabs.map(t => {
                                    const active = isOnRoute && currentTab === t.id;
                                    return (
                                        <SidebarMenuSubItem key={t.id}>
                                            <SidebarMenuSubButton asChild isActive={active}>
                                                <NavLink
                                                    to={`${basePath}?tab=${t.id}`}
                                                    className={active ? 'bg-primary/15 text-primary font-semibold' : ''}
                                                >
                                                    <t.icon className="h-3.5 w-3.5" />
                                                    <span>{t.label}</span>
                                                </NavLink>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                    );
                                })}
                            </SidebarMenuSub>
                        </CollapsibleContent>
                    )}
                </SidebarMenuItem>
            </Collapsible>
        );
    };

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="border-b border-sidebar-border">
                <div className="flex items-center gap-3 px-2 py-3">
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden shadow-glow bg-background/40"
                    >
                        <img
                            src={`${import.meta.env.BASE_URL}LogoNovo.png`}
                            alt="TECHNET"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    {!collapsed && (
                        <div>
                            <div className="text-sm font-extrabold text-sidebar-foreground leading-tight tracking-wide"><strong>TECHNET</strong></div>
                            <div className="text-[11px] text-muted-foreground"><strong>Financeiro</strong></div>
                        </div>
                    )}
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    {!collapsed && <SidebarGroupLabel>Módulos</SidebarGroupLabel>}
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === '/comissionamento' && currentTab === 'frentes'}
                                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                                >
                                    <NavLink to="/comissionamento?tab=frentes">
                                        <Layers className="h-4 w-4 flex-shrink-0" />
                                        {!collapsed && <span className="text-[13px]">Dashboard</span>}
                                    </NavLink>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === '/receitas'}
                                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                                >
                                    <NavLink to="/receitas">
                                        <TrendingUp className="h-4 w-4 flex-shrink-0" />
                                        {!collapsed && <span className="text-[13px]">Receitas</span>}
                                    </NavLink>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === '/comissionamento' && currentTab === 'kpis'}
                                    className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground h-auto min-h-9 py-2"
                                >
                                    <NavLink to="/comissionamento?tab=kpis">
                                        <DollarSign className="h-4 w-4 flex-shrink-0" />
                                        {!collapsed && <span className="text-[13px] leading-tight whitespace-normal break-words">Inclusão de Pagamentos</span>}
                                    </NavLink>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            {renderModule('/comissionamento', 'Relatórios', FileBarChart, RELATORIOS_TABS)}
                            {canViewFinancialReports && renderModule('/beneficios', 'Benefícios', Gift, BENEFICIOS_TABS)}
                            {canViewFinancialReports && renderModule('/folha-pagamento', 'Folha de Pagamento', Wallet, FOLHA_TABS)}
                            {canViewFinancialReports && (
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={pathname === '/dre-consolidado'}
                                        className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                                    >
                                        <NavLink to="/dre-consolidado">
                                            <FileBarChart className="h-4 w-4 flex-shrink-0" />
                                            {!collapsed && <span className="text-[13px]">DRE Consolidado</span>}
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )}
                            {canAccessSettings && (
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={pathname === '/configuracoes'}
                                        className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                                    >
                                        <NavLink to="/configuracoes">
                                            <Settings className="h-4 w-4 flex-shrink-0" />
                                            {!collapsed && <span className="text-[13px]">Configurações</span>}
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
};

export default AppSidebar;
