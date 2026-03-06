
import React, { useState, useRef, useEffect } from 'react';
import { CreateBill } from './components/CreateBill';
import { Dashboard } from './components/Dashboard';
import { BillHistory } from './components/BillHistory';
import { ProductManager } from './components/ProductManager';
import { PartyManager } from './components/PartyManager';
import { AddressManager } from './components/AddressManager';
import { VehicleManager } from './components/VehicleManager';
import { SalesOrderForm } from './components/SalesOrderForm';
import { OrderList } from './components/OrderList';
import { SalesDashboard } from './components/SalesDashboard';
import { ProductionEntry } from './components/ProductionEntry';
import { UserManager } from './components/UserManager';
import { StockLogReport } from './components/StockLogReport';
import { StatusScanner } from './components/StatusScanner';
import { Receipt } from './components/Receipt';
import { LoginScreen } from './components/LoginScreen';
import { TransactionLog } from './components/TransactionLog';
import { StockInOutReport } from './components/StockInOutReport';
import { InvoiceLookup } from './components/InvoiceLookup';
import { StockInventory } from './components/StockInventory';
import { WeightList } from './components/WeightList';
import { BackupManager } from './components/BackupManager';
import { DatabaseEditor } from './components/DatabaseEditor'; 
import { DispatchTickets } from './components/DispatchTickets'; // NEW IMPORT
import { DriverProfile } from './components/DriverProfile'; // NEW IMPORT
import { LayoutDashboard, PlusCircle, History, Package, Users, ScrollText, FileText, Truck, MapPin, Calculator, LogOut, ShoppingBag, List, ArrowLeft, Shield, ClipboardList, ScanLine, Layers, Activity, CheckCircle, ArrowLeftRight, Bell, X, Search, Lock, Clipboard, Database, Scale, Grid, Menu, Megaphone, AlertOctagon, RefreshCw, PenTool, Ticket, User as UserIcon } from 'lucide-react';
import { Bill, BillItem, BillType, User, UserRole, Product } from './types';
import { billService, productService, settingsService, systemService } from './services/supabase';

enum Screen {
  DASHBOARD = 'DASHBOARD',
  CREATE = 'CREATE',
  PARTIES = 'PARTIES',
  ADDRESSES = 'ADDRESSES',
  VEHICLES = 'VEHICLES',
  PRODUCTS = 'PRODUCTS',
  STOCK_INVENTORY = 'STOCK_INVENTORY',
  STOCK_LOGS = 'STOCK_LOGS',
  STOCK_IN_OUT = 'STOCK_IN_OUT',
  TRANSACTION_LOG = 'TRANSACTION_LOG',
  DISPATCH_LIST = 'DISPATCH_LIST',
  SMALL_BILL_LIST = 'SMALL_BILL_LIST',
  ALL_LOGS = 'ALL_LOGS',
  SALES_ORDER = 'SALES_ORDER',
  MY_ORDERS = 'MY_ORDERS',
  USERS = 'USERS',
  EMPLOYEE_SCANNER = 'EMPLOYEE_SCANNER',
  SALESMAN_SCANNER = 'SALESMAN_SCANNER',
  PRODUCTION_ENTRY = 'PRODUCTION_ENTRY',
  INVOICE_LOOKUP = 'INVOICE_LOOKUP',
  WEIGHT_LIST = 'WEIGHT_LIST',
  BACKUP = 'BACKUP',
  DB_EDITOR = 'DB_EDITOR',
  DISPATCH_TICKETS = 'DISPATCH_TICKETS',
  DRIVER_PROFILE = 'DRIVER_PROFILE', // NEW SCREEN ENUM
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.DASHBOARD);
  
  // Mobile Menu State for Admin
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [notificationDots, setNotificationDots] = useState({
    orders: false,
    dispatch: false,
    transactions: false,
    stock: false
  });

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutPassword, setLogoutPassword] = useState(''); 

  // Global System Lock State
  const [isSystemLocked, setIsSystemLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [refreshingLock, setRefreshingLock] = useState(false);

  const prevStatsRef = useRef({
      pendingCount: 0,
      deliveryCount: 0,
      doneCount: 0
  });
  const isFirstLoad = useRef(true);

  const [headerNotification, setHeaderNotification] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'info';
  }>({ show: false, message: '', type: 'success' });

  // PRINT STATE
  const [printBill, setPrintBill] = useState<Bill | null>(null);
  const [printItems, setPrintItems] = useState<BillItem[]>([]);
  const [printTrigger, setPrintTrigger] = useState<number>(0);
  const [masterProducts, setMasterProducts] = useState<Product[]>([]); 
  const receiptRef = useRef<HTMLDivElement>(null);

  // Load Products for Weight Calculation on Mount
  useEffect(() => {
      productService.getAll().then(setMasterProducts).catch(console.error);
  }, []);

  useEffect(() => {
    // 1. Check Session Storage (Transient - For Admin)
    const sessionUser = sessionStorage.getItem('greenzar_user');
    if (sessionUser) {
        try {
            const user = JSON.parse(sessionUser);
            if (user.role === UserRole.ADMIN) {
                setCurrentUser(user);
                handleNavigation(Screen.DASHBOARD);
                return;
            }
        } catch(e) { console.error(e); }
    }

    // 2. Check Local Storage (Persistent - For Salesman/Employee)
    const savedUser = localStorage.getItem('greenzar_user');
    if (savedUser) {
      try {
          const user = JSON.parse(savedUser);
          
          // SECURITY: If stored user is ADMIN, clear it (enforce session-only rule for Admin)
          if (user.role === UserRole.ADMIN) {
              localStorage.removeItem('greenzar_user');
              return;
          }

          setCurrentUser(user);
          if (user.role === UserRole.SALESMAN) {
            handleNavigation(Screen.DASHBOARD); 
          } else if (user.role === UserRole.EMPLOYEE) {
            handleNavigation(Screen.PRODUCTION_ENTRY);
          } else if (user.role === UserRole.DRIVER) {
            handleNavigation(Screen.DISPATCH_TICKETS);
          }
      } catch(e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
      if (!currentUser) return;

      const checkForUpdates = async () => {
          try {
              // 1. Check Orders
              const stats = await billService.getSalesDashboardStats();
              
              if (isFirstLoad.current) {
                  prevStatsRef.current = stats;
                  isFirstLoad.current = false;
                  return;
              }

              if (stats.pendingCount > prevStatsRef.current.pendingCount) {
                  if (currentScreen !== Screen.MY_ORDERS) {
                      triggerDot('orders');
                      triggerNotification('New Order Received!', 'info');
                  }
              }

              if (stats.deliveryCount !== prevStatsRef.current.deliveryCount || stats.doneCount !== prevStatsRef.current.doneCount) {
                   if (currentScreen !== Screen.DISPATCH_LIST && currentScreen !== Screen.MY_ORDERS) {
                       triggerDot('dispatch');
                       triggerNotification('Order Status Updated', 'info');
                   }
              }

              prevStatsRef.current = stats;

              // 2. Check System Access
              const sys = await systemService.getStatus();
              setIsSystemLocked(!sys.isOpen);
              setLockMessage(sys.message);

          } catch (e) {
              console.error("Polling error", e);
          }
      };

      // Run Immediately on mount/login to ensure security
      checkForUpdates();

      // Then poll every 5 seconds
      const interval = setInterval(checkForUpdates, 5000); 
      return () => clearInterval(interval);
  }, [currentUser, currentScreen]);


  const triggerNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setHeaderNotification({ show: true, message, type });
    setTimeout(() => {
      setHeaderNotification(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const closeNotification = () => {
    setHeaderNotification(prev => ({ ...prev, show: false }));
  };

  const handleNavigation = (screen: Screen) => {
    setCurrentScreen(screen);
    setMobileMenuOpen(false); // Close mobile menu on nav

    if (screen === Screen.MY_ORDERS) {
        setNotificationDots(prev => ({ ...prev, orders: false }));
    }
    else if (screen === Screen.DISPATCH_LIST) {
        setNotificationDots(prev => ({ ...prev, dispatch: false }));
    }
    else if (screen === Screen.TRANSACTION_LOG || screen === Screen.SMALL_BILL_LIST) {
        setNotificationDots(prev => ({ ...prev, transactions: false }));
    }
  };

  const triggerDot = (type: 'orders' | 'dispatch' | 'transactions' | 'stock') => {
      setNotificationDots(prev => ({ ...prev, [type]: true }));
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    
    if (user.role === UserRole.ADMIN) {
        // ADMIN: Use Session Storage (Lost on browser close)
        sessionStorage.setItem('greenzar_user', JSON.stringify(user));
        localStorage.removeItem('greenzar_user'); // Clean up any accidental persistence
        handleNavigation(Screen.DASHBOARD);
    } else {
        // SALESMAN/EMPLOYEE: Use Local Storage (Persistent)
        localStorage.setItem('greenzar_user', JSON.stringify(user));
        sessionStorage.removeItem('greenzar_user'); // Clean up
        
        if (user.role === UserRole.SALESMAN) handleNavigation(Screen.DASHBOARD);
        else if (user.role === UserRole.EMPLOYEE) handleNavigation(Screen.PRODUCTION_ENTRY);
        else if (user.role === UserRole.DRIVER) handleNavigation(Screen.DISPATCH_TICKETS);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('greenzar_user');
    sessionStorage.removeItem('greenzar_user');
    handleNavigation(Screen.DASHBOARD);
  };

  const requestLogout = () => {
      setLogoutPassword(''); 
      setShowLogoutModal(true);
  };

  const confirmLogout = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      
      if (logoutPassword !== '2006') {
          alert("Incorrect Logout PIN! Access Denied.");
          return;
      }

      handleLogout();
      setShowLogoutModal(false);
  };

  const checkLockStatus = async () => {
      setRefreshingLock(true);
      try {
          const sys = await systemService.getStatus();
          setIsSystemLocked(!sys.isOpen);
          setLockMessage(sys.message);
          if (sys.isOpen) {
              alert("System is back ONLINE!");
          }
      } finally {
          setRefreshingLock(false);
      }
  };

  const handleBillSaved = (bill: Bill, items: BillItem[], shouldPrint: boolean) => {
    if (shouldPrint) {
      setPrintBill(bill);
      setPrintItems(items);
      setPrintTrigger(prev => prev + 1);
    }

    if (bill.bill_type === BillType.ORDER) {
        triggerDot('orders');
    } else if (bill.bill_type === BillType.DISPATCH) {
        triggerDot('dispatch');
    } else if (bill.bill_type === BillType.SMALL) {
        triggerDot('transactions');
    }

    triggerNotification(`Bill ${bill.bill_no} Saved Successfully!`);
  };

  const handleReprint = (bill: Bill, items: BillItem[]) => {
    setPrintBill(bill);
    setPrintItems(items);
    setPrintTrigger(prev => prev + 1);
    triggerNotification("Sent to Printer...", "info");
  };

  const handleOrderStatusChange = () => {
      triggerDot('dispatch');
      triggerNotification("Order Status Updated!");
  };

  useEffect(() => {
    if (printTrigger > 0 && printBill) {
      const timer = setTimeout(() => {
        if (receiptRef.current) {
          window.print();
        }
      }, 1000); 
      return () => clearTimeout(timer);
    }
  }, [printTrigger, printBill]);

  const renderScreen = () => {
    if (!currentUser) return null;

    if (currentUser.role === UserRole.SALESMAN && currentScreen === Screen.DASHBOARD) {
        return <SalesDashboard user={currentUser} onLogout={requestLogout} onNavigate={(s) => handleNavigation(s)} />;
    }

    switch (currentScreen) {
      case Screen.DASHBOARD:
        return <Dashboard />;
      case Screen.CREATE:
        return <CreateBill onBillSaved={handleBillSaved} onNotification={triggerNotification} />;
      case Screen.PARTIES:
        return <PartyManager />;
      case Screen.ADDRESSES:
        return <AddressManager />;
      case Screen.VEHICLES:
        return <VehicleManager />;
      case Screen.PRODUCTS:
        return <ProductManager />;
      case Screen.WEIGHT_LIST:
        return <WeightList />;
      case Screen.STOCK_INVENTORY:
        return <StockInventory />;
      case Screen.STOCK_LOGS:
        return <StockLogReport />;
      case Screen.STOCK_IN_OUT:
        return <StockInOutReport />;
      case Screen.TRANSACTION_LOG:
        return <TransactionLog />;
      case Screen.DISPATCH_LIST:
        return <BillHistory onReprint={handleReprint} forcedFilter={BillType.DISPATCH} user={currentUser} />;
      case Screen.SMALL_BILL_LIST:
        return <BillHistory onReprint={handleReprint} forcedFilter={BillType.SMALL} user={currentUser} />;
      case Screen.ALL_LOGS:
        return <BillHistory onReprint={handleReprint} forcedFilter='ALL' user={currentUser} />;
      case Screen.INVOICE_LOOKUP:
        return <InvoiceLookup user={currentUser} />;
      case Screen.BACKUP:
        return <BackupManager />;
      case Screen.DB_EDITOR:
        return <DatabaseEditor />;
      case Screen.DISPATCH_TICKETS: // NEW CASE
        return <DispatchTickets onPrint={handleReprint} user={currentUser} />;
      case Screen.DRIVER_PROFILE:
        return <DriverProfile user={currentUser} onLogout={requestLogout} />;
      case Screen.SALES_ORDER:
        const backAction = (currentUser.role === UserRole.SALESMAN || currentUser.role === UserRole.EMPLOYEE) 
            ? () => handleNavigation(Screen.MY_ORDERS) 
            : undefined;
            
        return (
          <div className="h-full flex flex-col">
            {(currentUser.role === UserRole.SALESMAN || currentUser.role === UserRole.EMPLOYEE) && (
               <div className="mb-2">
                 <button onClick={backAction} className="flex items-center gap-2 text-gray-500 font-bold text-xs"><ArrowLeft size={16} /> Back to List</button>
               </div>
            )}
            <SalesOrderForm user={currentUser} onOrderSaved={() => {
                handleNavigation(Screen.MY_ORDERS);
            }} 
            onNotification={triggerNotification}
            />
          </div>
        );
      case Screen.MY_ORDERS:
        const backActionList = (currentUser.role === UserRole.SALESMAN || currentUser.role === UserRole.EMPLOYEE)
            ? () => {
                if (currentUser.role === UserRole.SALESMAN) handleNavigation(Screen.DASHBOARD);
                else handleNavigation(Screen.PRODUCTION_ENTRY);
            } 
            : undefined;
            
        return (
          <div className="h-full flex flex-col">
            {(currentUser.role === UserRole.SALESMAN || currentUser.role === UserRole.EMPLOYEE) && (
               <div className="mb-2">
                 <button onClick={backActionList} className="flex items-center gap-2 text-gray-500 font-bold text-xs"><ArrowLeft size={16} /> Back</button>
               </div>
            )}
            <OrderList 
                onPrintDispatch={handleReprint} 
                userRole={currentUser.role} 
                currentUser={currentUser} 
                onStatusUpdate={handleOrderStatusChange}
                onNotification={triggerNotification}
            />
          </div>
        );
      case Screen.USERS:
        return <UserManager />;
      case Screen.EMPLOYEE_SCANNER:
        return <div className="h-full relative"><StatusScanner role={UserRole.EMPLOYEE} user={currentUser} /></div>;
      case Screen.SALESMAN_SCANNER:
        return <div className="h-full flex flex-col"><div className="mb-4"><button onClick={() => handleNavigation(Screen.DASHBOARD)} className="flex items-center gap-2 text-gray-500 font-bold text-xs"><ArrowLeft size={16} /> Back</button></div><StatusScanner role={UserRole.SALESMAN} user={currentUser} /></div>;
      case Screen.PRODUCTION_ENTRY:
        return <ProductionEntry 
            user={currentUser} 
            onLogout={requestLogout} 
            onNotification={triggerNotification}
            onOpenOrder={() => handleNavigation(Screen.SALES_ORDER)}
        />;
      default:
        return <Dashboard />;
    }
  };

  // ... (NavItem component remains same)
  const NavItem: React.FC<{ screen: Screen, icon: any, label: string, showDot?: boolean }> = ({ screen, icon: Icon, label, showDot }) => (
    <button
      onClick={() => handleNavigation(screen)}
      className={`relative flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all group ${
        currentScreen === screen 
          ? 'bg-sky-600 text-white shadow-md shadow-sky-200' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className={currentScreen === screen ? "text-white" : "text-slate-400 group-hover:text-slate-600"} />
        <span className="font-bold text-xs tracking-wide uppercase">{label}</span>
      </div>
      
      {showDot && (
          <div className="flex items-center justify-center">
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 border border-white"></span>
          </div>
      )}
    </button>
  );

  // ... (adminNavGroups remains same)
  const adminNavGroups = [
    {
        title: null,
        items: [
            { screen: Screen.DASHBOARD, icon: LayoutDashboard, label: "Dashboard" },
            { screen: Screen.INVOICE_LOOKUP, icon: Search, label: "Invoice Check" },
        ]
    },
    {
        title: "Operations",
        items: [
            { screen: Screen.CREATE, icon: PlusCircle, label: "Create Bill" },
            { screen: Screen.SALES_ORDER, icon: ShoppingBag, label: "New Order" },
            { screen: Screen.STOCK_INVENTORY, icon: Grid, label: "Stock Inventory" },
            { screen: Screen.DISPATCH_TICKETS, icon: Ticket, label: "Ticket Queue" }, // Added to Admin sidebar too
        ]
    },
    {
        title: "Masters",
        items: [
            { screen: Screen.WEIGHT_LIST, icon: Scale, label: "Weight List" },
            { screen: Screen.PARTIES, icon: Users, label: "Party Names" },
            { screen: Screen.ADDRESSES, icon: MapPin, label: "Addresses" },
            { screen: Screen.VEHICLES, icon: Truck, label: "Vehicles" },
            { screen: Screen.PRODUCTS, icon: Package, label: "Products" },
        ]
    },
    {
        title: "Reports",
        items: [
            { screen: Screen.MY_ORDERS, icon: List, label: "Order List", dot: notificationDots.orders },
            { screen: Screen.DISPATCH_LIST, icon: ScrollText, label: "Dispatch List", dot: notificationDots.dispatch },
            { screen: Screen.SMALL_BILL_LIST, icon: FileText, label: "Small Bill List" },
            { screen: Screen.STOCK_LOGS, icon: ClipboardList, label: "Stock Input Logs" },
            { screen: Screen.STOCK_IN_OUT, icon: ArrowLeftRight, label: "Stock In/Out Status" },
            { screen: Screen.TRANSACTION_LOG, icon: Activity, label: "Daily Transactions", dot: notificationDots.transactions },
            { screen: Screen.ALL_LOGS, icon: History, label: "All Print Logs" },
        ]
    },
    {
        title: "System",
        items: [
            { screen: Screen.USERS, icon: Shield, label: "User Management" },
            { screen: Screen.BACKUP, icon: Database, label: "Backup & Restore" },
            { screen: Screen.DB_EDITOR, icon: PenTool, label: "Database Editor" },
        ]
    }
  ];

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // ... (Lock screen logic remains same)
  if (isSystemLocked && currentUser.role !== UserRole.ADMIN) {
      return (
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
              <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-red-900/50 animate-pulse">
                  <AlertOctagon size={48} className="text-white" />
              </div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Access Locked</h1>
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-8">System Unavailable</p>
              
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 max-w-sm w-full shadow-xl">
                  <p className="text-white font-bold text-lg leading-relaxed">
                      {lockMessage || "The administrator has temporarily closed access to the application."}
                  </p>
              </div>

              <div className="mt-8 flex flex-col gap-4 w-full max-w-xs">
                  <button 
                    onClick={checkLockStatus} 
                    disabled={refreshingLock}
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold uppercase tracking-wider hover:bg-emerald-500 transition shadow-lg flex items-center justify-center gap-2"
                  >
                      {refreshingLock ? <RefreshCw className="animate-spin" /> : <RefreshCw />} Check Status
                  </button>
                  <button onClick={handleLogout} className="text-slate-500 font-bold hover:text-slate-300 transition text-xs">
                      Log Out
                  </button>
              </div>
          </div>
      );
  }

  const NotificationBanner = () => (
    <div 
        className={`fixed top-0 left-0 right-0 z-[100] transform transition-transform duration-300 ease-in-out ${
            headerNotification.show ? 'translate-y-0' : '-translate-y-full'
        }`}
    >
        <div className={`${
            headerNotification.type === 'success' ? 'bg-emerald-600' : 'bg-sky-600'
        } text-white px-4 py-3 shadow-md flex items-center justify-between`}>
            <div className="flex items-center gap-3">
                {headerNotification.type === 'success' ? <CheckCircle size={20} /> : <Bell size={20} />}
                <span className="font-bold text-sm">{headerNotification.message}</span>
            </div>
            <button onClick={closeNotification} className="text-white/80 hover:text-white">
                <X size={20} />
            </button>
        </div>
    </div>
  );

  const isMobileRole = currentUser.role === UserRole.SALESMAN || currentUser.role === UserRole.EMPLOYEE || currentUser.role === UserRole.DRIVER;

  return (
    <div className={`h-screen bg-slate-50 text-gray-900 font-sans overflow-hidden flex flex-col relative ${isMobileRole ? '' : 'md:flex-row'}`}>
      <NotificationBanner />

      {/* --- DESKTOP SIDEBAR (Hidden on Mobile) --- */}
      {!isMobileRole && (
        <aside className="hidden md:flex flex-col w-72 bg-slate-50 border-r border-slate-200 print:hidden shadow-lg z-20 h-full flex-shrink-0">
            <div className="p-6 border-b border-slate-200 bg-white">
            <h1 className="text-2xl font-black tracking-tighter text-sky-600">GREENZAR<span className="text-slate-800">STOCK</span></h1>
            <div className="flex items-center gap-3 mt-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                    {currentUser.name.substring(0,1)}
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{currentUser.role} ACCESS</p>
                </div>
            </div>
            </div>
            
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-hide">
            {adminNavGroups.map((group, idx) => (
                <div key={idx}>
                    {group.title && <div className="mt-6 mb-2 pl-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{group.title}</div>}
                    {group.items.map(item => (
                        <NavItem 
                            key={item.screen} 
                            screen={item.screen} 
                            icon={item.icon} 
                            label={item.label} 
                            showDot={item.dot} 
                        />
                    ))}
                </div>
            ))}
            </nav>

            <div className="p-4 border-t border-slate-200 bg-white">
            <button onClick={requestLogout} className="w-full flex items-center justify-center gap-2 p-3 text-red-600 hover:bg-red-50 rounded-xl transition font-bold text-xs border border-transparent hover:border-red-100">
                <LogOut size={16} /> SECURE LOGOUT
            </button>
            </div>
        </aside>
      )}

      {/* ... (Mobile Menu Logic kept same) ... */}
      {!isMobileRole && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setMobileMenuOpen(false)}></div>
            
            {/* Slide-out Drawer */}
            <div className="relative bg-white w-[80%] max-w-sm h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-lg font-black text-sky-600 tracking-tight">MENU</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase">Greenzar Admin</p>
                    </div>
                    <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-white rounded-full shadow-sm text-gray-400 border border-gray-200"><X size={20}/></button>
                </div>
                
                <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                    {adminNavGroups.map((group, idx) => (
                        <div key={idx}>
                            {group.title && <div className="mt-5 mb-2 pl-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{group.title}</div>}
                            {group.items.map(item => (
                                <NavItem 
                                    key={item.screen} 
                                    screen={item.screen} 
                                    icon={item.icon} 
                                    label={item.label} 
                                    showDot={item.dot} 
                                />
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-100 bg-slate-50">
                    <button onClick={requestLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-100 text-red-600 rounded-xl font-bold text-xs">
                        <LogOut size={16} /> LOGOUT
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- Main Content Area --- */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        
        {/* Mobile Header (Only for Admin on Mobile) */}
        {!isMobileRole && (
            <header className="md:hidden bg-sky-600 text-white p-4 shadow-md sticky top-0 z-20 flex justify-between items-center print:hidden flex-shrink-0">
            <div className="flex items-center gap-3">
                <button onClick={() => setMobileMenuOpen(true)} className="p-1 rounded hover:bg-sky-700 transition">
                    <Menu size={24}/>
                </button>
                <h1 className="text-lg font-bold tracking-wide">GREENZAR</h1>
            </div>
            <button onClick={requestLogout} className="bg-sky-700 p-1.5 rounded"><LogOut size={16} /></button>
            </header>
        )}

        {/* Content Render */}
        <main className={`flex-1 overflow-y-auto ${isMobileRole ? 'p-3 pb-20 pt-4' : 'p-4 md:p-8 pb-24 md:pb-8'} print:hidden`}>
          <div className="max-w-[1600px] mx-auto h-full pt-1">
            {renderScreen()}
          </div>
        </main>

        {/* Mobile Bottom Nav (Salesman) */}
        {isMobileRole && currentUser.role === UserRole.SALESMAN && (
            <div className="bg-white border-t border-gray-200 p-1 flex justify-around shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30 fixed bottom-0 left-0 right-0 h-[60px] items-center">
                <button onClick={() => handleNavigation(Screen.DASHBOARD)} className={`flex flex-col items-center p-2 rounded-lg transition ${currentScreen === Screen.DASHBOARD ? 'text-sky-600 bg-sky-50' : 'text-gray-400'}`}>
                    <LayoutDashboard size={20} />
                    <span className="text-[10px] font-bold mt-0.5">Home</span>
                </button>
                <button onClick={() => handleNavigation(Screen.INVOICE_LOOKUP)} className={`flex flex-col items-center p-2 rounded-lg transition ${currentScreen === Screen.INVOICE_LOOKUP ? 'text-sky-600 bg-sky-50' : 'text-gray-400'}`}>
                    <Search size={20} />
                    <span className="text-[10px] font-bold mt-0.5">Check</span>
                </button>
                <button onClick={() => handleNavigation(Screen.SALESMAN_SCANNER)} className={`flex flex-col items-center p-2 rounded-lg transition ${currentScreen === Screen.SALESMAN_SCANNER ? 'text-sky-600 bg-sky-50' : 'text-gray-400'}`}>
                    <ScanLine size={20} />
                    <span className="text-[10px] font-bold mt-0.5">Scan</span>
                </button>
                <button onClick={() => handleNavigation(Screen.MY_ORDERS)} className={`relative flex flex-col items-center p-2 rounded-lg transition ${currentScreen === Screen.MY_ORDERS ? 'text-sky-600 bg-sky-50' : 'text-gray-400'}`}>
                    <div className="relative">
                    <List size={20} />
                    {notificationDots.orders && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-600 rounded-full border-2 border-white"></span>}
                    </div>
                    <span className="text-[10px] font-bold mt-0.5">History</span>
                </button>
            </div>
        )}

        {/* Mobile Bottom Nav (Employee) - UPDATED WITH TICKETS */}
        {isMobileRole && currentUser.role === UserRole.EMPLOYEE && (
            <div className="bg-white border-t border-gray-200 p-1 flex justify-around shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30 fixed bottom-0 left-0 right-0 h-[60px] items-center">
                <button onClick={() => handleNavigation(Screen.PRODUCTION_ENTRY)} className={`flex flex-col items-center p-2 rounded-lg transition ${currentScreen === Screen.PRODUCTION_ENTRY ? 'text-sky-600 bg-sky-50' : 'text-gray-400'}`}>
                    <Layers size={20} />
                    <span className="text-[10px] font-bold mt-0.5">Input</span>
                </button>
                
                {/* NEW TICKET BUTTON */}
                <button onClick={() => handleNavigation(Screen.DISPATCH_TICKETS)} className={`flex flex-col items-center p-2 rounded-lg transition ${currentScreen === Screen.DISPATCH_TICKETS ? 'text-sky-600 bg-sky-50' : 'text-gray-400'}`}>
                    <Ticket size={20} />
                    <span className="text-[10px] font-bold mt-0.5">Tickets</span>
                </button>

                <button onClick={() => handleNavigation(Screen.EMPLOYEE_SCANNER)} className={`flex flex-col items-center p-2 rounded-lg transition ${currentScreen === Screen.EMPLOYEE_SCANNER ? 'text-sky-600 bg-sky-50' : 'text-gray-400'}`}>
                    <ScanLine size={20} />
                    <span className="text-[10px] font-bold mt-0.5">Scan</span>
                </button>
                
                <button onClick={() => handleNavigation(Screen.MY_ORDERS)} className={`flex flex-col items-center p-2 rounded-lg transition ${currentScreen === Screen.MY_ORDERS ? 'text-sky-600 bg-sky-50' : 'text-gray-400'}`}>
                    <List size={20} />
                    <span className="text-[10px] font-bold mt-0.5">List</span>
                </button>
            </div>
        )}

        {/* Mobile Bottom Nav (Driver) */}
        {isMobileRole && currentUser.role === UserRole.DRIVER && (
            <div className="bg-white border-t border-gray-200 p-1 flex justify-around shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30 fixed bottom-0 left-0 right-0 h-[60px] items-center">
                <button onClick={() => handleNavigation(Screen.DISPATCH_TICKETS)} className={`flex flex-col items-center p-2 rounded-lg transition ${currentScreen === Screen.DISPATCH_TICKETS ? 'text-sky-600 bg-sky-50' : 'text-gray-400'}`}>
                    <Ticket size={20} />
                    <span className="text-[10px] font-bold mt-0.5">Tickets</span>
                </button>
                <button onClick={() => handleNavigation(Screen.DISPATCH_LIST)} className={`flex flex-col items-center p-2 rounded-lg transition ${currentScreen === Screen.DISPATCH_LIST ? 'text-sky-600 bg-sky-50' : 'text-gray-400'}`}>
                    <ScrollText size={20} />
                    <span className="text-[10px] font-bold mt-0.5">History</span>
                </button>
                <button onClick={() => handleNavigation(Screen.DRIVER_PROFILE)} className={`flex flex-col items-center p-2 rounded-lg transition ${currentScreen === Screen.DRIVER_PROFILE ? 'text-sky-600 bg-sky-50' : 'text-gray-400'}`}>
                    <UserIcon size={20} />
                    <span className="text-[10px] font-bold mt-0.5">Account</span>
                </button>
            </div>
        )}
      </div>

      {showLogoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 shadow-inner">
                          <LogOut size={32} />
                      </div>
                      <h3 className="text-xl font-black text-slate-800 tracking-tight">Confirm Logout</h3>
                      <p className="text-sm text-slate-500 font-bold mt-1">Enter PIN to end session</p>
                  </div>
                  <form onSubmit={confirmLogout}>
                      <div className="mb-6">
                          <input 
                            type="password" 
                            value={logoutPassword}
                            onChange={(e) => setLogoutPassword(e.target.value)}
                            className="w-full p-3 text-center text-xl font-bold border border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none bg-gray-50 tracking-widest text-slate-800 placeholder-gray-300 transition"
                            placeholder="PIN"
                            autoFocus
                            inputMode="numeric"
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <button type="button" onClick={() => setShowLogoutModal(false)} className="py-3 bg-slate-100 text-slate-500 font-bold rounded-xl text-sm hover:bg-slate-200 transition">CANCEL</button>
                          <button type="submit" className="py-3 bg-red-600 text-white font-bold rounded-xl text-sm shadow-xl shadow-red-200 hover:bg-red-700 transition">LOGOUT</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      <div className="fixed top-0 left-0 w-full h-full bg-white z-[100] opacity-0 pointer-events-none print:opacity-100 print:pointer-events-auto">
        <Receipt ref={receiptRef} bill={printBill} items={printItems} products={masterProducts} />
      </div>

    </div>
  );
};

export default App;
