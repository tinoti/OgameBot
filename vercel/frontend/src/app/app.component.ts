import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { timeoutWith } from 'rxjs/operators'
import { throwError } from 'rxjs'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'OgameBot';

  constructor(private http: HttpClient) { }

  planets: any
  galaxy: any
  systemFrom: any
  systemTo: any
  sortedList: any
  spyReports: any

  login(){
    this.http.get("http://localhost:3000/login").subscribe(data => {
      console.log(data)
    })
  }

  spy(){
    this.http.post("http://localhost:3000/spy", this.sortedList).subscribe(response => {
      console.log(response)
    })
  }

  getSpyReports(){
    this.http.get("http://localhost:3031/bot/sort-spy-reports").subscribe(response => {
      this.spyReports = response
      console.log(this.spyReports)
    })
  }

  attack(){
    this.http.post("http://localhost:3000/attack", this.spyReports).subscribe(response => {
      console.log(response)
    })
  }

  checkHostileFleet(){
    this.http.get("http://localhost:3000/check-hostile-fleet").subscribe(response => {
      console.log(response)
    })
  }

  click() {

    let headers = {
      "access-control-allow-credentials": "true",
      "Access-Control-Allow-Origin": "*"
    }

    let options = {
      headers: headers
    }


    this.http.get("http://localhost:3000/get-planets").subscribe(data => {
      console.log("ayy")
      // console.log(data)
      this.planets = data

      let sortGalaxy = this.planets.filter((o: any)=> o.galaxy == this.galaxy)
      let sortSystem = sortGalaxy.filter((o:any) => o.system >= this.systemFrom && o.system <= this.systemTo)
      let sortInactive = sortSystem.filter((o:any) => o.status === "I")

      this.sortedList = sortInactive

      console.log(this.sortedList)
    })

  }
}

