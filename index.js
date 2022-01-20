import express from 'express';
import fetch from 'node-fetch';
import keyBy from 'lodash/keyby.js';
import sortBy from 'lodash/sortby.js';
import toNumber from 'lodash/toNumber.js';

const app = express();
const port = 5100;

const API_BASE_URL = 'https://swapi.dev/api';
const PEOPLE_ENDPOINT = `${API_BASE_URL}/people`;
const PLANET_ENDPOINT = `${API_BASE_URL}/planets`;
const ALLOWED_FILTERS = ['name', 'height', 'mass'];
const parseValueBy = {
  name: i => i,
  height: i => toNumber(i),
  mass: i => toNumber(i.replace(",", ""))
}

const fetchPeople = async ({ shouldSort, property }) => {
  const people = [];
  const response = await fetch(PEOPLE_ENDPOINT);
  let subset = await response.json();
    
  people.push(...subset.results);
  while (subset.next) {
    const anotherResponse = await fetch(subset.next);
    subset = await anotherResponse.json();
    people.push(...subset.results);
  }
  return shouldSort? sortBy(people, person => parseValueBy[property](person[property])) : people;
}

app.get('/people', async (req, res) => { 
  const params = req.query;
  const shouldSort = params.sortBy && typeof params.sortBy === 'string' && ALLOWED_FILTERS.includes(params.sortBy.toLowerCase());
  const property = params.sortBy;

  let people = [];

  try {
    people = await fetchPeople({ shouldSort, property });
  } catch (error) {
    console.log('Woops, something went wrong', { error });

    return res.status(500).json({ description: 'something went wrong, please try again later' });
  }

  res.status(200).json({ people });
});

const planetsWithResidentFullNames = ({ planets, residentsByUrl }) => {
  return planets.reduce((acc, currentPlanet) => {
    currentPlanet.residents = currentPlanet.residents.map(residentUrl => residentsByUrl[residentUrl].name);
    acc.push(currentPlanet);
    return acc;
  }, []);
}

app.get('/planets', async (_, res) => {
  const planets = [];
  
  try {  
    const people = await fetchPeople({ shouldSort: false });
    const residentsByUrl = keyBy(people, 'url');

    const response = await fetch(PLANET_ENDPOINT);
    let subset = await response.json();
    planets.push(...planetsWithResidentFullNames({ planets: subset.results, residentsByUrl }));

    while (subset.next) {
      const anotherResponse = await fetch(subset.next);
      subset = await anotherResponse.json();
      planets.push(...planetsWithResidentFullNames({ planets: subset.results, residentsByUrl }));
    }

  } catch (error) {
    console.log('Woops, something went wrong', { error });

    return res.status(500).json({ description: 'something went wrong, please try again later' });
  }

  res.status(200).json({ planets });
})

app.listen(port, () => {
  console.log(`Howdy! Listening requests on http://localhost:${port}`);
});