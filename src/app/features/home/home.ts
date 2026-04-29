import { Component } from '@angular/core';
import { ServicesShowcase } from '../services-showcase/services-showcase';
import { Pricing } from '../pricing/pricing';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  imports: [CommonModule, ServicesShowcase, Pricing],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {}
