import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { timeoutWith } from 'rxjs/operators'
import { throwError } from 'rxjs'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'OgameBot';

  constructor(private http: HttpClient) { }

  planets: any
  galaxy: any
  systemFrom: any
  systemTo: any
  sortedList: any
  spyReports: any
  planetList: any

  ngOnInit() {
    this.http.get("http://localhost:3031/bot/get-planet-list").subscribe(data => {
      this.planetList = data
    })
  }

  displayedColumns: string[] = ['availableLoot', 'numberOfShipsNeeded', 'deut', 'position', 'attack'];
  dataSource: any[] = []

  login(){
    this.http.get("http://localhost:3031/bot/login").subscribe(data => {
      console.log(data)
    })
  }

  spy(){
    const selectedPlanet = document.querySelector('#selectPlanet') as HTMLSelectElement

    this.http.post("http://localhost:3031/bot/spy", {
      galaxy: this.galaxy,
      systemFrom: this.systemFrom,
      systemTo: this.systemTo,
      selectedPlanetId: selectedPlanet.value
    }).subscribe(response => {
      console.log(response)
    })
  }

  getSpyReports(){
    this.http.get("http://localhost:3031/bot/sort-spy-reports").subscribe((response: any) => {
      this.dataSource = response
    })
  }

  attackSingleTarget(spyReport: any){
    console.log(spyReport)
    this.http.post("http://localhost:3031/bot/attack", spyReport).subscribe(response => {
      console.log(response)
    })
  }

  autoAttack() {
    const selectedPlanet = document.querySelector('#selectPlanet') as HTMLSelectElement

    this.http.post("http://localhost:3031/bot/auto-attack", {
      selectedPlanetId: selectedPlanet.value
    }).subscribe(response => {
      console.log(response)
    })
  }

  checkHostileFleet(){
    this.http.get("http://localhost:3031/bot/check-hostile-fleet").subscribe(response => {
      console.log(response)
    })
  }

  spyAndAttack() {
    this.http.get("http://localhost:3031/bot/spy-and-attack").subscribe(data => {
      console.log(data)
    })
  }



}

