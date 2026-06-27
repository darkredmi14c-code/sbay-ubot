import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { KeywordsComponent } from './pages/keywords/keywords.component';
import { GroupsComponent } from './pages/groups/groups.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { UsersComponent } from './pages/users/users.component';
import { BroadcastComponent } from './pages/broadcast/broadcast.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'keywords', component: KeywordsComponent },
  { path: 'groups', component: GroupsComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'broadcast', component: BroadcastComponent },
  { path: 'users', component: UsersComponent },
  { path: '**', redirectTo: '' },
];
