# SouthernScheduler

This was my group project for my Software Engineering course at Georgia Southern University.

Our group wanted to streamline the registration experience at our university via a web application.

With Axios and Node.JS, I created an ETL pipeline that extracts course data via HTTP requests from https://coursesearch.georgiasouthern.edu/.

Using the csv-writer library, I exported this data to our SQL server in Azure, which powers our website made in Typescript. 
