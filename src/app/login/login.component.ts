import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  loading = false;
  errorMessage = '';

  form = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private router: Router
  ) {}

  submit() {
  this.errorMessage = '';

  if (this.form.invalid) return;

  this.loading = true;

  const request = {
    username: this.form.value.username!,
    password: this.form.value.password!
  };

  this.userService.login(request).subscribe({
    next: (res) => {
      this.userService.saveLogin(res);

      const role = res.user.role;

      if (role === 'SUPER_ADMIN') {
        this.router.navigate(['/management']);
      } else if (role === 'ADMIN') {
        this.router.navigate(['/dashboard']);
      }

      this.loading = false;
    },
    error: () => {
      this.errorMessage = 'Invalid username or password';
      this.loading = false;
    }
  });
}

}
