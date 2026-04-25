import { Routes } from '@angular/router';
import { RoleGuard } from './core/guards/role.guard';
import { AdminConsoleComponent } from './pages/admin/admin-console.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { IncidentDetailComponent } from './pages/incident-detail/incident-detail.component';
import { IncidentFormComponent } from './pages/incident-form/incident-form.component';
import { IncidentQueueComponent } from './pages/incident-queue/incident-queue.component';
import { LoginComponent } from './pages/login/login.component';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [RoleGuard],
    canActivateChild: [RoleGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        component: DashboardComponent,
        data: { roles: ['ADMIN', 'ANALYST'] }
      },
      {
        path: 'incidents',
        component: IncidentQueueComponent,
        data: { roles: ['ADMIN', 'ANALYST'] }
      },
      {
        path: 'incidents/new',
        component: IncidentFormComponent,
        data: { roles: ['ADMIN', 'ANALYST'] }
      },
      {
        path: 'incidents/:id',
        component: IncidentDetailComponent,
        data: { roles: ['ADMIN', 'ANALYST'] }
      },
      {
        path: 'my-cases',
        component: IncidentQueueComponent,
        data: { roles: ['ANALYST'], mineOnly: true }
      },
      {
        path: 'admin/systems',
        component: AdminConsoleComponent,
        data: { roles: ['ADMIN'], panel: 'systems' }
      },
      {
        path: 'admin/users',
        component: AdminConsoleComponent,
        data: { roles: ['ADMIN'], panel: 'users' }
      },
      {
        path: 'admin/audit',
        component: AdminConsoleComponent,
        data: { roles: ['ADMIN'], panel: 'audit' }
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
